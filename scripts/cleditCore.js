/* jshint -W084, -W099 */

(function(diff_match_patch) {

    function cledit(contentElt, scrollElt, windowParam) {
        scrollElt = scrollElt || contentElt;
        var editor = {
            $contentElt: contentElt,
            $scrollElt: scrollElt,
            $window: windowParam || window,
            $keystrokes: [],
            $markers: {}
        };
        editor.$document = editor.$window.document;
        cledit.Utils.createEventHooks(editor);
        var debounce = cledit.Utils.debounce;

        editor.toggleEditable = function(isEditable) {
            if (isEditable === undefined) {
                isEditable = !contentElt.contentEditable;
            }
            contentElt.contentEditable = isEditable;
        };
        editor.toggleEditable(true);

        function getTextContent() {
            var textContent = contentElt.textContent.replace(/\r\n?/g, '\n'); // Mac/DOS to Unix
            if (textContent.slice(-1) !== '\n') {
                textContent += '\n';
            }
            return textContent;
        }

        var lastTextContent = getTextContent();
        var highlighter = new cledit.Highlighter(editor);

        var sectionList;

        function parseSections(content, isInit) {
            sectionList = highlighter.parseSections(content, isInit);
            editor.$allElements = Array.prototype.slice.call(contentElt.querySelectorAll('.cledit-section *'));
            editor.$trigger('contentChanged', content, sectionList);
        }

        // Used to detect editor changes
        var watcher = new cledit.Watcher(editor, checkContentChange);
        watcher.startWatching();

        var diffMatchPatch = new diff_match_patch();
        var selectionMgr = new cledit.SelectionMgr(editor);

        function adjustCursorPosition(force) {
            selectionMgr.saveSelectionState(true, true, force);
        }

        function replaceContent(selectionStart, selectionEnd, replacement) {
            var min = Math.min(selectionStart, selectionEnd);
            var max = Math.max(selectionStart, selectionEnd);
            var range = selectionMgr.createRange(min, max);
            var rangeText = '' + range;
            // Range can contain a br element, which is not taken into account in rangeText
            if (rangeText.length === max - min && rangeText == replacement) {
                return;
            }
            range.deleteContents();
            range.insertNode(editor.$document.createTextNode(replacement));
            return range;
        }

        var ignorePatches = false,
            noContentFix = false;

        function setContent(value, noUndo, maxStartOffset) {
            var textContent = getTextContent();
            maxStartOffset = maxStartOffset !== undefined && maxStartOffset < textContent.length ? maxStartOffset : textContent.length - 1;
            var startOffset = Math.min(
                diffMatchPatch.diff_commonPrefix(textContent, value),
                maxStartOffset
            );
            var endOffset = Math.min(
                diffMatchPatch.diff_commonSuffix(textContent, value),
                textContent.length - startOffset,
                value.length - startOffset
            );
            var replacement = value.substring(startOffset, value.length - endOffset);
            var range = replaceContent(startOffset, textContent.length - endOffset, replacement);
            if (range) {
                ignorePatches = noUndo;
                noContentFix = true;
            }
            return {
                start: startOffset,
                end: value.length - endOffset,
                range: range
            };
        }

        function replace(selectionStart, selectionEnd, replacement) {
            undoMgr.setDefaultMode('single');
            replaceContent(selectionStart, selectionEnd, replacement);
            var endOffset = selectionStart + replacement.length;
            selectionMgr.setSelectionStartEnd(endOffset, endOffset);
            selectionMgr.updateCursorCoordinates(true);
        }

        function replaceAll(search, replacement) {
            undoMgr.setDefaultMode('single');
            var textContent = getTextContent();
            var value = textContent.replace(search, replacement);
            if (value != textContent) {
                var offset = editor.setContent(value);
                selectionMgr.setSelectionStartEnd(offset.end, offset.end);
                selectionMgr.updateCursorCoordinates(true);
            }
        }

        function focus() {
            selectionMgr.restoreSelection();
        }

        var undoMgr = new cledit.UndoMgr(editor);

        function addMarker(marker) {
            editor.$markers[marker.id] = marker;
        }

        function removeMarker(marker) {
            delete editor.$markers[marker.id];
        }

        var triggerSpellCheck = debounce(function() {
            var selection = editor.$window.getSelection();
            if (!selectionMgr.hasFocus || highlighter.isComposing || selectionMgr.selectionStart !== selectionMgr.selectionEnd || !selection.modify) {
                return;
            }
            // Hack for Chrome to trigger the spell checker
            if (selectionMgr.selectionStart) {
                selection.modify("move", "backward", "character");
                selection.modify("move", "forward", "character");
            } else {
                selection.modify("move", "forward", "character");
                selection.modify("move", "backward", "character");
            }
        }, 10);

        function checkContentChange(mutations) {
            watcher.noWatch(function() {
                var removedSections = [];
                var modifiedSections = [];

                function markModifiedSection(node) {
                    while (node && node !== contentElt) {
                        if (node.section) {
                            var array = node.parentNode ? modifiedSections : removedSections;
                            return array.indexOf(node.section) === -1 && array.push(node.section);
                        }
                        node = node.parentNode;
                    }
                }

                mutations.cl_each(function(mutation) {
                    markModifiedSection(mutation.target);
                    mutation.addedNodes.cl_each(markModifiedSection);
                    mutation.removedNodes.cl_each(markModifiedSection);
                });
                highlighter.fixContent(modifiedSections, removedSections, noContentFix);
                noContentFix = false;
            });
            var newTextContent = getTextContent();
            var diffs = diffMatchPatch.diff_main(lastTextContent, newTextContent);
            if (!ignorePatches) {
                var patches = diffMatchPatch.patch_make(lastTextContent, diffs);
                undoMgr.addPatches(patches);
                undoMgr.setDefaultMode('typing');
            }

            editor.$markers.cl_each(function(marker) {
                marker.adjustOffset(diffs);
            });

            lastTextContent = newTextContent;
            selectionMgr.saveSelectionState();
            parseSections(lastTextContent);
            ignorePatches || undoMgr.saveState();
            ignorePatches = false;
            triggerSpellCheck();
        }

        // See https://gist.github.com/shimondoodkin/1081133
        // TODO
        /*
         if(/AppleWebKit\/([\d.]+)/.exec(navigator.userAgent)) {
         var $editableFix = $('<input style="width:1px;height:1px;border:none;margin:0;padding:0;" tabIndex="-1">').appendTo('html');
         $contentElt.blur(function() {
         $editableFix[0].setSelectionRange(0, 0);
         $editableFix.blur();
         });
         }
         */

        function setSelection(start, end) {
            end = end === undefined ? start : end;
            selectionMgr.setSelectionStartEnd(start, end);
            selectionMgr.updateCursorCoordinates();
        }

        function keydownHandler(handler) {
            return function(evt) {
                if (
                    evt.which !== 17 && // Ctrl
                    evt.which !== 91 && // Cmd
                    evt.which !== 18 && // Alt
                    evt.which !== 16 // Shift
                ) {
                    handler(evt);
                }
            };
        }

        function removeEventListeners() {
            editor.$window.removeEventListener('keydown', windowKeydownListener);
            editor.$window.removeEventListener('mouseup', windowMouseupListener);
        }

        // In case of Ctrl/Cmd+A outside the editor element
        function windowKeydownListener(evt) {
            if (!editor.$window.document.contains(contentElt)) {
                return removeEventListeners();
            }
            keydownHandler(function() {
                adjustCursorPosition();
            })(evt);
        }
        editor.$window.addEventListener('keydown', windowKeydownListener, false);

        // Mouseup can happen outside the editor element
        function windowMouseupListener() {
            if (!editor.$window.document.contains(contentElt)) {
                return removeEventListeners();
            }
            selectionMgr.saveSelectionState(true, false);
        }
        editor.$window.addEventListener('mouseup', windowMouseupListener);
        // This can also provoke selection changes and does not fire mouseup event on Chrome/OSX
        contentElt.addEventListener('contextmenu', selectionMgr.saveSelectionState.cl_bind(selectionMgr, true, false));

        contentElt.addEventListener('keydown', keydownHandler(function(evt) {
            selectionMgr.saveSelectionState();
            adjustCursorPosition();

            // Perform keystroke
            var textContent = editor.getContent();
            var min = Math.min(selectionMgr.selectionStart, selectionMgr.selectionEnd);
            var max = Math.max(selectionMgr.selectionStart, selectionMgr.selectionEnd);
            var state = {
                before: textContent.slice(0, min),
                after: textContent.slice(max),
                selection: textContent.slice(min, max),
                isBackwardSelection: selectionMgr.selectionStart > selectionMgr.selectionEnd
            };
            editor.$keystrokes.cl_some(function(keystroke) {
                if (keystroke.handler(evt, state, editor)) {
                    editor.setContent(state.before + state.selection + state.after, false, min);
                    min = state.before.length;
                    max = min + state.selection.length;
                    selectionMgr.setSelectionStartEnd(
                        state.isBackwardSelection ? max : min,
                        state.isBackwardSelection ? min : max
                    );
                    return true;
                }
            });
        }), false);

        contentElt.addEventListener('compositionstart', function() {
            highlighter.isComposing++;
        }, false);

        contentElt.addEventListener('compositionend', function() {
            setTimeout(function() {
                highlighter.isComposing && highlighter.isComposing--;
            }, 0);
        }, false);

        contentElt.addEventListener('paste', function(evt) {
            undoMgr.setCurrentMode('single');
            evt.preventDefault();
            var data, clipboardData = evt.clipboardData;
            if (clipboardData) {
                data = clipboardData.getData('text/plain');
            } else {
                clipboardData = editor.$window.clipboardData;
                data = clipboardData && clipboardData.getData('Text');
            }
            if (!data) {
                return;
            }
            replace(selectionMgr.selectionStart, selectionMgr.selectionEnd, data);
            adjustCursorPosition();
        }, false);

        contentElt.addEventListener('cut', function() {
            undoMgr.setCurrentMode('single');
            adjustCursorPosition();
        }, false);

        contentElt.addEventListener('focus', function() {
            selectionMgr.hasFocus = true;
            editor.$trigger('focus');
        }, false);

        contentElt.addEventListener('blur', function() {
            selectionMgr.hasFocus = false;
            editor.$trigger('blur');
        }, false);

        function addKeystroke(keystrokes) {
            if (!Array.isArray(keystrokes)) {
                keystrokes = [keystrokes];
            }
            editor.$keystrokes = editor.$keystrokes.concat(keystrokes).sort(function(keystroke1, keystroke2) {
                return keystroke1.priority - keystroke2.priority;
            });
        }
        addKeystroke(cledit.defaultKeystrokes);

        editor.selectionMgr = selectionMgr;
        editor.undoMgr = undoMgr;
        editor.highlighter = highlighter;
        editor.watcher = watcher;
        editor.adjustCursorPosition = adjustCursorPosition;
        editor.setContent = setContent;
        editor.replace = replace;
        editor.replaceAll = replaceAll;
        editor.getContent = getTextContent;
        editor.focus = focus;
        editor.setSelection = setSelection;
        editor.addKeystroke = addKeystroke;
        editor.addMarker = addMarker;
        editor.removeMarker = removeMarker;

        editor.init = function(options) {
            options = ({
                cursorFocusRatio: 0.5,
                highlighter: function(text) {
                    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
                },
                sectionDelimiter: ''
            }).cl_extend(options || {});
            editor.options = options;

            if (options.content !== undefined) {
                lastTextContent = options.content.toString();
                if (lastTextContent.slice(-1) !== '\n') {
                    lastTextContent += '\n';
                }
            }

            parseSections(lastTextContent, true);
            if (options.selectionStart !== undefined && options.selectionEnd !== undefined) {
                editor.setSelection(options.selectionStart, options.selectionEnd);
            } else {
                selectionMgr.saveSelectionState();
            }
            undoMgr.init();

            if (options.scrollTop !== undefined) {
                scrollElt.scrollTop = options.scrollTop;
            }
        };

        return editor;
    }

    window.cledit = cledit;
})(window.diff_match_patch);
