/* jshint -W084, -W099 */
(function(ced) {

	function UndoMgr(editor) {
		var selectionMgr = editor.selectionMgr;
		var undoStack = [];
		var redoStack = [];
		var lastTime = 0;
		var lastMode;
		var currentState;
		var selectionStartBefore;
		var selectionEndBefore;
		var debounce = ced.Utils.debounce;

		this.setCommandMode = function() {
			this.currentMode = 'command';
		};

		this.setMode = function() {
		}; // For compatibility with PageDown

		this.onButtonStateChange = function() {
		}; // To be overridden by PageDown

		this.saveState = debounce((function() {
			redoStack = [];
			var currentTime = Date.now();
			if(this.currentMode == 'comment' ||
				this.currentMode == 'replace' ||
				lastMode == 'newlines' ||
				this.currentMode != lastMode ||
				currentTime - lastTime > 1000) {
				undoStack.push(currentState);
				// Limit the size of the stack
				while(undoStack.length > 100) {
					undoStack.shift();
				}
			}
			else {
				// Restore selectionBefore that has potentially been modified by saveSelectionState
				selectionStartBefore = currentState.selectionStartBefore;
				selectionEndBefore = currentState.selectionEndBefore;
			}
			currentState = {
				selectionStartBefore: selectionStartBefore,
				selectionEndBefore: selectionEndBefore,
				selectionStartAfter: selectionMgr.selectionStart,
				selectionEndAfter: selectionMgr.selectionEnd,
				content: editor.getValue(),
				// TODO
				// discussionListJSON: fileDesc.discussionListJSON
			};
			lastTime = currentTime;
			lastMode = this.currentMode;
			this.currentMode = undefined;
			this.onButtonStateChange();
		}).bind(this));

		this.saveSelectionState = debounce(function() {
			// Should happen just after saveState
			if(this.currentMode === undefined) {
				selectionStartBefore = selectionMgr.selectionStart;
				selectionEndBefore = selectionMgr.selectionEnd;
			}
		}, 50);

		this.canUndo = function() {
			return undoStack.length;
		};

		this.canRedo = function() {
			return redoStack.length;
		};

		function restoreState(state, selectionStart, selectionEnd) {
			// Update editor
			editor.setValue(state.content, true);
			selectionMgr.setSelectionStartEnd(selectionStart, selectionEnd);
			selectionMgr.updateSelectionRange();
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
			currentState = state;
			this.currentMode = undefined;
			lastMode = undefined;
			this.onButtonStateChange();
			editor.adjustCursorPosition();
		}

		this.undo = function() {
			var state = undoStack.pop();
			if(!state) {
				return;
			}
			redoStack.push(currentState);
			restoreState.call(this, state, currentState.selectionStartBefore, currentState.selectionEndBefore);
		};

		this.redo = function() {
			var state = redoStack.pop();
			if(!state) {
				return;
			}
			undoStack.push(currentState);
			restoreState.call(this, state, state.selectionStartAfter, state.selectionEndAfter);
		};

		currentState = {
			selectionStartAfter: selectionMgr.selectionStart,
			selectionEndAfter: selectionMgr.selectionEnd,
			content: editor.getValue(),
			// TODO
			//discussionListJSON: fileDesc.discussionListJSON
		};

		this.currentMode = undefined;
	}

	ced.UndoMgr = UndoMgr;

})(window.ced);
