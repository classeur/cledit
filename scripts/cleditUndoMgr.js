/* jshint -W084, -W099 */
(function(cledit, diff_match_patch) {

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
		var debounce = cledit.Utils.debounce;

		function State() {}

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

		var diffMatchPatch = new diff_match_patch();
		var contentNotIgnored;
		var ignoredPatches = [];

		this.addPatches = function(patches) {
			Array.prototype.push.apply(currentPatches, patches);
		};

		this.ignorePatches = function(patches) {
			Array.prototype.push.apply(ignoredPatches, patches);
		};

		function saveCurrentPatches() {
			// Move currentPatches into previousPatches
			Array.prototype.push.apply(previousPatches, currentPatches);
			currentPatches = [];
		}

		this.saveState = debounce(function() {
			redoStack.length = 0;
			if (!stateMgr.isBufferState()) {
				currentState.addToUndoStack();

				// Limit the size of the stack
				while (undoStack.length > options.undoStackMaxSize) {
					undoStack.shift();
				}
			}
			saveCurrentPatches();
			currentState = new State();
			stateMgr.saveMode();
			self.$trigger('undoStateChange');
		});

		this.canUndo = function() {
			return !!undoStack.length;
		};

		this.canRedo = function() {
			return !!redoStack.length;
		};

		function restoreState(patches, isForward) {
			// Update editor
			var content = editor.getContent();
			patches = isForward ? patches : patches.map(function(patch) {
				return {
					insert: !patch.insert,
					offset: patch.offset,
					text: patch.text
				};
			}).reverse();
			var selectionBefore = content.length;
			var selectionAfter = 0;
			patches.forEach(function(patch) {
				selectionBefore = Math.min(selectionBefore, patch.offset);
				selectionAfter = Math.max(selectionAfter, patch.offset + (patch.insert ? patch.text.length : 0));
				if (patch.insert) {
					content = content.slice(0, patch.offset) + patch.text + content.slice(patch.offset);
				} else {
					content = content.slice(0, patch.offset) + content.slice(patch.offset + patch.text.length);
				}
			});
			editor.setContentInternal(content, true);
			editor.$markers.forEach(function(marker) {
				patches.forEach(marker.adjustOffset, marker);
			});

			isForward ?
				selectionMgr.setSelectionStartEnd(selectionAfter, selectionAfter) :
				selectionMgr.setSelectionStartEnd(selectionBefore, selectionBefore);

			selectionMgr.updateCursorCoordinates(true);
			// TODO
			/*
			 var discussionListJSON = fileDesc.discussionListJSON;
			 if(discussionListJSON !=
state.discussionListJSON) {
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

			stateMgr.resetMode();
			self.$trigger('undoStateChange');
			editor.adjustCursorPosition();
		}

		this.undo = function() {
			var state = undoStack.pop();
			if (!state) {
				return;
			}
			saveCurrentPatches();
			currentState.addToRedoStack();
			restoreState(currentState.patches);
			previousPatches = state.patches;
			currentState = state;
		};

		this.redo = function() {
			var state = redoStack.pop();
			if (!state) {
				return;
			}
			currentState.addToUndoStack();
			restoreState(state.patches, true);
			previousPatches = state.patches;
			currentState = state;
		};

		this.init = function() {
			selectionMgr = editor.selectionMgr;
			if (!currentState) {
				contentNotIgnored = editor.getContent();
				currentState = new State();
			}
		};
	}

	cledit.UndoMgr = UndoMgr;

})(window.cledit, window.diff_match_patch);
