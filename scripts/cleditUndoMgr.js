/* jshint -W084, -W099 */
(function(cledit) {

	function UndoMgr(editor, options) {
		cledit.Utils.createEventHooks(this);

		options = cledit.Utils.extend({
			undoStackMaxSize: 200,
			bufferStateUntilIdle: 1000
		}, options || {});

		var self = this;
		var selectionMgr;
		var undoStack = [];
		var redoStack = [];
		var currentState;
		var previousPatches = [];
		var currentPatches = [];
		var selectionStartBefore;
		var selectionEndBefore;
		var debounce = cledit.Utils.debounce;

		function State() {
			this.selectionStartBefore = selectionStartBefore;
			this.selectionEndBefore = selectionEndBefore;
			this.selectionStartAfter = selectionMgr.selectionStart;
			this.selectionEndAfter = selectionMgr.selectionEnd;
		}

		function addToStack(stack) {
			return function() {
				stack.push(this);
				this.patches = previousPatches;
				previousPatches = [];
			};
		}

		State.prototype.addToUndoStack = addToStack(undoStack);
		State.prototype.addToRedoStack = addToStack(redoStack);

		function StateMgr() {
			var currentTime, lastTime;
			var lastMode;

			this.isBufferState = function() {
				currentTime = Date.now();
				return this.currentMode != 'single' &&
					this.currentMode == lastMode &&
					currentTime - lastTime < options.bufferStateUntilIdle;
			};

			this.setDefaultMode = function(mode) {
				this.currentMode = this.currentMode || mode;
			};

			this.resetMode = function() {
				stateMgr.currentMode = undefined;
				lastMode = undefined;
			};

			this.saveMode = function() {
				lastMode = this.currentMode;
				this.currentMode = undefined;
				lastTime = currentTime;
			};
		}

		var stateMgr = new StateMgr();
		this.setCurrentMode = function(mode) {
			stateMgr.currentMode = mode;
		};
		this.setDefaultMode = stateMgr.setDefaultMode.bind(stateMgr);

		this.addPatches = function(patches) {
			Array.prototype.push.apply(currentPatches, patches);
		};

		function saveCurrentPatches() {
			// Move currentPatches into previousPatches
			Array.prototype.push.apply(previousPatches, currentPatches);
			currentPatches = [];
		}

		this.saveState = debounce(function() {
			redoStack.length = 0;
			if(stateMgr.isBufferState()) {
				// Restore selectionBefore that has potentially been modified by saveSelectionState
				selectionStartBefore = currentState.selectionStartBefore;
				selectionEndBefore = currentState.selectionEndBefore;
			}
			else {
				// Save current state
				currentState.addToUndoStack();

				// Limit the size of the stack
				while(undoStack.length > options.undoStackMaxSize) {
					undoStack.shift();
				}
			}
			saveCurrentPatches();
			currentState = new State();
			stateMgr.saveMode();
			self.$trigger('undoStateChange');
		});

		this.saveSelectionState = debounce(function() {
			// Supposed to happen just after saveState
			if(stateMgr.currentMode === undefined) {
				selectionStartBefore = selectionMgr.selectionStart;
				selectionEndBefore = selectionMgr.selectionEnd;
			}
		}, 50);

		this.canUndo = function() {
			return !!undoStack.length;
		};

		this.canRedo = function() {
			return !!redoStack.length;
		};

		function restoreState(patches, selectionStart, selectionEnd, isForward) {
			// Update editor
			var content = editor.getContent();
			patches = isForward ? patches : patches.map(function(patch) {
				return {
					insert: !patch.insert,
					offset: patch.offset,
					text: patch.text
				};
			}).reverse();
			patches.forEach(function(patch) {
				if(patch.insert) {
					content = content.slice(0, patch.offset) + patch.text + content.slice(patch.offset);
				}
				else {
					content = content.slice(0, patch.offset) + content.slice(patch.offset + patch.text.length);
				}
			});
			editor.setContent(content, true);
			editor.$markers.forEach(function(marker) {
				patches.forEach(marker.adjustOffset, marker);
			});

			selectionMgr.setSelectionStartEnd(selectionStart, selectionEnd);
			selectionMgr.updateCursorCoordinates(true);
			// TODO
			/*
			 var discussionListJSON = fileDesc.discussionListJSON;
			 if(discussionListJSON != state.discussionListJSON) {
			 var oldDiscussionList = fileDesc.discussionList;
			 fileDesc.discussionListJSON = state.discussionListJSON;
			 var newDiscussionList = fileDesc.discussionList;
			 var diff = jsonDiffPatch.diff(oldDiscussionList, newDiscussionList);
			 var commentsChanged = false;
			 _.each(diff, function(discussionDiff, discussionIndex) {
			 if(!_.isArray(discussionDiff)) {
			 commentsChanged = true;
			 }
			 else if(discussionDiff.length === 1) {
			 eventMgr.onDiscussionCreated(fileDesc, newDiscussionList[discussionIndex]);
			 }
			 else {
			 eventMgr.onDiscussionRemoved(fileDesc, oldDiscussionList[discussionIndex]);
			 }
			 });
			 commentsChanged && eventMgr.onCommentsChanged(fileDesc);
			 }
			 */

			selectionStartBefore = selectionStart;
			selectionEndBefore = selectionEnd;
			stateMgr.resetMode();
			self.$trigger('undoStateChange');
			editor.adjustCursorPosition();
		}

		this.undo = function() {
			var state = undoStack.pop();
			if(!state) {
				return;
			}
			saveCurrentPatches();
			currentState.addToRedoStack();
			restoreState(currentState.patches, currentState.selectionStartBefore, currentState.selectionEndBefore);
			previousPatches = state.patches;
			currentState = state;
		};

		this.redo = function() {
			var state = redoStack.pop();
			if(!state) {
				return;
			}
			currentState.addToUndoStack();
			restoreState(state.patches, state.selectionStartAfter, state.selectionEndAfter, true);
			previousPatches = state.patches;
			currentState = state;
		};

		this.init = function() {
			selectionMgr = editor.selectionMgr;
			currentState = currentState || new State();
		};
	}

	cledit.UndoMgr = UndoMgr;

})(window.cledit);
