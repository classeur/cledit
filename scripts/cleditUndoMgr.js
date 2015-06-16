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

		this.addPatches = function(patches) {
			currentPatches.push.apply(currentPatches, patches);
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
			if(!isForward) {
				patches = diffMatchPatch.patch_deepCopy(patches).reverse();
				patches.forEach(function(patch) {
					patch.diffs.forEach(function(diff) {
						diff[0] = -diff[0];
					});
				});
			}

			var newContent = diffMatchPatch.patch_apply(patches, content)[0];
			var range = editor.setContent(newContent, true);

			var diffs = diffMatchPatch.diff_main(content, newContent);
			Object.keys(editor.$markers).forEach(function(id) {
				editor.$markers[id].adjustOffset(diffs);
			});

			selectionMgr.setSelectionStartEnd(range.end, range.end);
			selectionMgr.updateCursorCoordinates(true);

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
				currentState = new State();
			}
		};
	}

	cledit.UndoMgr = UndoMgr;

})(window.cledit, window.diff_match_patch);
