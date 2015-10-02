(function(cledit) {

    function Keystroke(handler, priority) {
        this.handler = handler;
        this.priority = priority || 100;
    }

    Keystroke.prototype.perform = function(evt, editor) {
        var textContent = editor.getContent();
        var min = Math.min(editor.selectionMgr.selectionStart, editor.selectionMgr.selectionEnd);
        var max = Math.max(editor.selectionMgr.selectionStart, editor.selectionMgr.selectionEnd);
        var isBackwardSelection = editor.selectionMgr.selectionStart > editor.selectionMgr.selectionEnd;
        var state = {
            before: textContent.slice(0, min),
            after: textContent.slice(max),
            selection: textContent.slice(min, max)
        };
        if (this.handler(evt, state, editor)) {
            editor.setContent(state.before + state.selection + state.after, false, min);
            min = state.before.length;
            max = min + state.selection.length;
            editor.selectionMgr.setSelectionStartEnd(
                isBackwardSelection ? max : min,
                isBackwardSelection ? min : max
            );
            return true;
        }
    };

    cledit.Keystroke = Keystroke;

    var clearNewline;
    cledit.defaultKeystrokes = [

        new Keystroke(function(evt, state, editor) {
            if ((!evt.ctrlKey && !evt.metaKey) || evt.altKey) {
                return;
            }
            var keyCode = evt.charCode || evt.keyCode;
            var keyCodeChar = String.fromCharCode(keyCode).toLowerCase();
            var action;
            switch (keyCodeChar) {
                case "y":
                    action = 'redo';
                    break;
                case "z":
                    action = evt.shiftKey ? 'redo' : 'undo';
                    break;
            }
            if (action) {
                evt.preventDefault();
                setTimeout(function() {
                    editor.undoMgr[action]();
                }, 10);
                return true;
            }
        }),

        new Keystroke(function(evt, state) {
            if (evt.which !== 9 || evt.metaKey || evt.ctrlKey) {
                // Not tab
                return;
            }

            function strSplice(str, i, remove, add) {
                remove = +remove || 0;
                add = add || '';
                return str.slice(0, i) + add + str.slice(i + remove);
            }

            evt.preventDefault();
            var isInverse = evt.shiftKey;
            var lf = state.before.lastIndexOf('\n') + 1;
            if (isInverse) {
                if (/\s/.test(state.before.charAt(lf))) {
                    state.before = strSplice(state.before, lf, 1);
                }
                state.selection = state.selection.replace(/^[ \t]/gm, '');
            } else {
                if (state.selection) {
                    state.before = strSplice(state.before, lf, 0, '\t');
                    state.selection = state.selection.replace(/\n(?=[\s\S])/g, '\n\t');
                } else {
                    state.before += '\t';
                }
            }
            return true;
        }),

        new Keystroke(function(evt, state, editor) {
            if (evt.which !== 13) {
                // Not enter
                clearNewline = false;
                return;
            }

            evt.preventDefault();
            var lf = state.before.lastIndexOf('\n') + 1;
            if (clearNewline) {
                state.before = state.before.substring(0, lf);
                state.selection = '';
                clearNewline = false;
                return true;
            }
            clearNewline = false;
            var previousLine = state.before.slice(lf);
            var indent = previousLine.match(/^\s*/)[0];
            if (indent.length) {
                clearNewline = true;
            }

            editor.undoMgr.setCurrentMode('single');
            state.before += '\n' + indent;
            state.selection = '';
            return true;
        }),

        new Keystroke(function(evt, state, editor) {
            if (evt.which !== 8 && evt.which !== 46) {
                // Not backspace nor delete
                return;
            }

            evt.preventDefault();
            editor.undoMgr.setCurrentMode('delete');
            if (!state.selection) {
                if (evt.which === 8) {
                    state.before = state.before.slice(0, -1);
                } else {
                    state.after = state.after.slice(1);
                }
            }
            state.selection = '';
            return true;
        })
    ];

})(window.cledit);
