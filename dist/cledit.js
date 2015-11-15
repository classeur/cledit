/* global HTMLCollection, NodeList */
(function() {

	var arrayProperties = {},
		liveCollectionProperties = {},
		functionProperties = {},
		objectProperties = {},
		slice = Array.prototype.slice;

	arrayProperties.cl_each = function(cb) {
		var i = 0,
			length = this.length;
		for (; i < length; i++) {
			cb(this[i], i, this);
		}
	};

	arrayProperties.cl_map = function(cb) {
		var i = 0,
			length = this.length,
			result = Array(length);
		for (; i < length; i++) {
			result[i] = cb(this[i], i, this);
		}
		return result;
	};

	arrayProperties.cl_reduce = function(cb, memo) {
		var i = 0,
			length = this.length;
		for (; i < length; i++) {
			memo = cb(memo, this[i], i, this);
		}
		return memo;
	};

	arrayProperties.cl_some = function(cb) {
		var i = 0,
			length = this.length;
		for (; i < length; i++) {
			if (cb(this[i], i, this)) {
				return true;
			}
		}
	};

	arrayProperties.cl_filter = function(cb) {
		var i = 0,
			length = this.length,
			result = [];
		for (; i < length; i++) {
			cb(this[i], i, this) && result.push(this[i]);
		}
		return result;
	};

	liveCollectionProperties.cl_each = function(cb) {
		slice.call(this).cl_each(cb);
	};

	liveCollectionProperties.cl_map = function(cb) {
		return slice.call(this).cl_map(cb);
	};

	liveCollectionProperties.cl_reduce = function(cb, memo) {
		return slice.call(this).cl_reduce(cb, memo);
	};

	functionProperties.cl_bind = function(context) {
		var self = this,
			args = slice.call(arguments, 1);
		context = context || null;
		return args.length ?
			function() {
				return arguments.length ?
					self.apply(context, args.concat(slice.call(arguments))) :
					self.apply(context, args);
			} :
			function() {
				return arguments.length ?
					self.apply(context, arguments) :
					self.call(context);
			};
	};

	objectProperties.cl_each = function(cb) {
		var i = 0,
			keys = Object.keys(this),
			length = keys.length;
		for (; i < length; i++) {
			cb(this[keys[i]], keys[i], this);
		}
	};

	objectProperties.cl_map = function(cb) {
		var i = 0,
			keys = Object.keys(this),
			length = keys.length,
			result = Array(length);
		for (; i < length; i++) {
			result[i] = cb(this[keys[i]], keys[i], this);
		}
		return result;
	};

	objectProperties.cl_reduce = function(cb, memo) {
		var i = 0,
			keys = Object.keys(this),
			length = keys.length;
		for (; i < length; i++) {
			memo = cb(memo, this[keys[i]], keys[i], this);
		}
		return memo;
	};

	objectProperties.cl_extend = function(obj) {
		if (obj) {
			var i = 0,
				keys = Object.keys(obj),
				length = keys.length;
			for (; i < length; i++) {
				this[keys[i]] = obj[keys[i]];
			}
		}
		return this;
	};

	function build(properties) {
		return objectProperties.cl_reduce.call(properties, function(memo, value, key) {
			memo[key] = {
				value: value
			};
			return memo;
		}, {});
	}

	arrayProperties = build(arrayProperties);
	liveCollectionProperties = build(liveCollectionProperties);
	functionProperties = build(functionProperties);
	objectProperties = build(objectProperties);

	Object.defineProperties(Array.prototype, arrayProperties);
	Object.defineProperties(Function.prototype, functionProperties);
	Object.defineProperties(Object.prototype, objectProperties);
	if (typeof window != 'undefined') {
		Object.defineProperties(HTMLCollection.prototype, liveCollectionProperties);
		Object.defineProperties(NodeList.prototype, liveCollectionProperties);
	}

})();

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
            if (newTextContent && newTextContent == lastTextContent) {
                return;
            }
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
            var isBackwardSelection = selectionMgr.selectionStart > selectionMgr.selectionEnd;
            var state = {
                before: textContent.slice(0, min),
                after: textContent.slice(max),
                selection: textContent.slice(min, max)
            };
            editor.$keystrokes.cl_some(function(keystroke) {
                if (keystroke.handler(evt, state, editor)) {
                    editor.setContent(state.before + state.selection + state.after, false, min);
                    min = state.before.length;
                    max = min + state.selection.length;
                    selectionMgr.setSelectionStartEnd(
                        isBackwardSelection ? max : min,
                        isBackwardSelection ? min : max
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
                highlighter.isComposing--;
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

(function(cledit) {

    var styleElts = [];

    function createStyleSheet(document) {
        var styleElt = document.createElement('style');
        styleElt.type = 'text/css';
        styleElt.innerHTML = '.cledit-section * { display: inline; }';
        document.head.appendChild(styleElt);
        styleElts.push(styleElt);
    }

    function Highlighter(editor) {
        var self = this;
        cledit.Utils.createEventHooks(this);

        styleElts.cl_some(function(styleElt) {
            return editor.$document.head.contains(styleElt);
        }) || createStyleSheet(editor.$document);

        var contentElt = editor.$contentElt;
        this.isComposing = 0;

        var sectionList = [];
        var insertBeforeSection;
        var useBr = cledit.Utils.isWebkit;
        var trailingNodeTag = 'div';
        var hiddenLfInnerHtml = '<br><span class="hd-lf" style="display: none">\n</span>';

        var lfHtml = '<span class="lf">' + (useBr ? hiddenLfInnerHtml : '\n') + '</span>';

        this.fixContent = function(modifiedSections, removedSections, noContentFix) {
            modifiedSections.cl_each(function(section) {
                section.forceHighlighting = true;
                if (!noContentFix) {
                    if (useBr) {
                        section.elt.getElementsByClassName('hd-lf').cl_each(function(lfElt) {
                            lfElt.parentNode.removeChild(lfElt);
                        });
                        section.elt.getElementsByTagName('br').cl_each(function(brElt) {
                            brElt.parentNode.replaceChild(editor.$document.createTextNode('\n'), brElt);
                        });
                    }
                    if (section.elt.textContent.slice(-1) !== '\n') {
                        section.elt.appendChild(editor.$document.createTextNode('\n'));
                    }
                }
            });
        };

        this.addTrailingNode = function() {
            this.trailingNode = editor.$document.createElement(trailingNodeTag);
            contentElt.appendChild(this.trailingNode);
        };

        function Section(text) {
            this.text = text;
        }

        Section.prototype.setElement = function(elt) {
            this.elt = elt;
            elt.section = this;
        };

        this.parseSections = function(content, isInit) {
            if (this.isComposing) {
                return sectionList;
            }

            var newSectionList = editor.options.sectionParser ? editor.options.sectionParser(content) : [content];
            newSectionList = newSectionList.cl_map(function(sectionText) {
                return new Section(sectionText);
            });

            var modifiedSections = [];
            var sectionsToRemove = [];
            insertBeforeSection = undefined;

            if (isInit) {
                // Render everything if isInit
                sectionsToRemove = sectionList;
                sectionList = newSectionList;
                modifiedSections = newSectionList;
            } else {
                // Find modified section starting from top
                var leftIndex = sectionList.length;
                sectionList.cl_some(function(section, index) {
                    var newSection = newSectionList[index];
                    if (index >= newSectionList.length ||
                        section.forceHighlighting ||
                        // Check text modification
                        section.text != newSection.text ||
                        // Check that section has not been detached or moved
                        section.elt.parentNode !== contentElt ||
                        // Check also the content since nodes can be injected in sections via copy/paste
                        section.elt.textContent != newSection.text) {
                        leftIndex = index;
                        return true;
                    }
                });

                // Find modified section starting from bottom
                var rightIndex = -sectionList.length;
                sectionList.slice().reverse().cl_some(function(section, index) {
                    var newSection = newSectionList[newSectionList.length - index - 1];
                    if (index >= newSectionList.length ||
                        section.forceHighlighting ||
                        // Check modified
                        section.text != newSection.text ||
                        // Check that section has not been detached or moved
                        section.elt.parentNode !== contentElt ||
                        // Check also the content since nodes can be injected in sections via copy/paste
                        section.elt.textContent != newSection.text) {
                        rightIndex = -index;
                        return true;
                    }
                });

                if (leftIndex - rightIndex > sectionList.length) {
                    // Prevent overlap
                    rightIndex = leftIndex - sectionList.length;
                }

                var leftSections = sectionList.slice(0, leftIndex);
                modifiedSections = newSectionList.slice(leftIndex, newSectionList.length + rightIndex);
                var rightSections = sectionList.slice(sectionList.length + rightIndex, sectionList.length);
                insertBeforeSection = rightSections[0];
                sectionsToRemove = sectionList.slice(leftIndex, sectionList.length + rightIndex);
                sectionList = leftSections.concat(modifiedSections).concat(rightSections);
            }

            var newSectionEltList = editor.$document.createDocumentFragment();
            modifiedSections.cl_each(function(section) {
                section.forceHighlighting = false;
                highlight(section);
                newSectionEltList.appendChild(section.elt);
            });
            editor.watcher.noWatch((function() {
                if (isInit) {
                    contentElt.innerHTML = '';
                    contentElt.appendChild(newSectionEltList);
                    return this.addTrailingNode();
                }

                // Remove outdated sections
                sectionsToRemove.cl_each(function(section) {
                    // section may be already removed
                    section.elt.parentNode === contentElt && contentElt.removeChild(section.elt);
                    // To detect sections that come back with built-in undo
                    section.elt.section = undefined;
                });

                if (insertBeforeSection !== undefined) {
                    contentElt.insertBefore(newSectionEltList, insertBeforeSection.elt);
                } else {
                    contentElt.appendChild(newSectionEltList);
                }

                // Remove unauthorized nodes (text nodes outside of sections or duplicated sections via copy/paste)
                var childNode = contentElt.firstChild;
                while (childNode) {
                    var nextNode = childNode.nextSibling;
                    if (!childNode.section) {
                        contentElt.removeChild(childNode);
                    }
                    childNode = nextNode;
                }
                this.addTrailingNode();
                self.$trigger('highlighted');
                editor.selectionMgr.restoreSelection();
                editor.selectionMgr.updateCursorCoordinates();
            }).cl_bind(this));

            return sectionList;
        };

        function highlight(section) {
            var html = editor.options.highlighter(section.text).replace(/\n/g, lfHtml);
            var sectionElt = editor.$document.createElement('div');
            sectionElt.className = 'cledit-section';
            sectionElt.innerHTML = html;
            section.setElement(sectionElt);
            self.$trigger('sectionHighlighted', section);

            //section.addTrailingLf();
        }
    }

    cledit.Highlighter = Highlighter;

})(window.cledit);

(function(cledit) {

    function Keystroke(handler, priority) {
        this.handler = handler;
        this.priority = priority || 100;
    }

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

(function(cledit) {

	var DIFF_DELETE = -1;
	var DIFF_INSERT = 1;
	var DIFF_EQUAL = 0;

	var idCounter = 0;

	function Marker(offset) {
		this.id = idCounter++;
		this.offset = offset;
	}

	Marker.prototype.adjustOffset = function(diffs) {
		var startOffset = 0;
		diffs.cl_each((function(diff) {
			var diffType = diff[0];
			var diffText = diff[1];
			var diffOffset = diffText.length;
			switch (diffType) {
				case DIFF_EQUAL:
					startOffset += diffOffset;
					break;
				case DIFF_INSERT:
					if (this.offset > startOffset) {
						this.offset += diffOffset;
					}
					startOffset += diffOffset;
					break;
				case DIFF_DELETE:
					if (this.offset > startOffset) {
						this.offset -= diffOffset;
					}
					break;
			}
		}).cl_bind(this));
	};

	cledit.Marker = Marker;

})(window.cledit);

/* jshint -W084 */
(function(cledit) {

	function SelectionMgr(editor) {
		var debounce = cledit.Utils.debounce;
		var contentElt = editor.$contentElt;
		var scrollElt = editor.$scrollElt;
		cledit.Utils.createEventHooks(this);

		var self = this;
		var lastSelectionStart = 0,
			lastSelectionEnd = 0;
		this.selectionStart = 0;
		this.selectionEnd = 0;
		this.cursorCoordinates = {};
		this.adjustTop = 0;
		this.adjustBottom = 0;

		this.findContainer = function(offset) {
			var result = cledit.Utils.findContainer(contentElt, offset);
			if (result.container.nodeValue === '\n') {
				var hdLfElt = result.container.parentNode;
				if (hdLfElt.className === 'hd-lf' && hdLfElt.previousSibling && hdLfElt.previousSibling.tagName === 'BR') {
					result.container = hdLfElt.parentNode;
					result.offsetInContainer = Array.prototype.indexOf.call(result.container.childNodes, result.offsetInContainer === 0 ? hdLfElt.previousSibling : hdLfElt);
				}
			}
			return result;
		};

		this.createRange = function(start, end) {
			var range = editor.$document.createRange();
			if (start === end) {
				end = start = isNaN(start) ? start : this.findContainer(start < 0 ? 0 : start);
			} else {
				start = isNaN(start) ? start : this.findContainer(start < 0 ? 0 : start);
				end = isNaN(end) ? end : this.findContainer(end < 0 ? 0 : end);
			}
			range.setStart(start.container, start.offsetInContainer);
			range.setEnd(end.container, end.offsetInContainer);
			return range;
		};

		var adjustScroll;
		var debouncedUpdateCursorCoordinates = debounce((function() {
			var coordinates = this.getCoordinates(this.selectionEnd, this.selectionEndContainer, this.selectionEndOffset);
			if (this.cursorCoordinates.top !== coordinates.top ||
				this.cursorCoordinates.height !== coordinates.height ||
				this.cursorCoordinates.left !== coordinates.left
			) {
				this.cursorCoordinates = coordinates;
				this.$trigger('cursorCoordinatesChanged', coordinates);
			}
			if (adjustScroll) {
				var adjustTop, adjustBottom;
				adjustTop = adjustBottom = scrollElt.clientHeight / 2 * editor.options.cursorFocusRatio;
				adjustTop = this.adjustTop || adjustTop;
				adjustBottom = this.adjustBottom || adjustTop;
				if (adjustTop && adjustBottom) {
					var cursorMinY = scrollElt.scrollTop + adjustTop;
					var cursorMaxY = scrollElt.scrollTop + scrollElt.clientHeight - adjustBottom;
					if (this.cursorCoordinates.top < cursorMinY) {
						scrollElt.scrollTop += this.cursorCoordinates.top - cursorMinY;
					} else if (this.cursorCoordinates.top + this.cursorCoordinates.height > cursorMaxY) {
						scrollElt.scrollTop += this.cursorCoordinates.top + this.cursorCoordinates.height - cursorMaxY;
					}
				}
			}
			adjustScroll = false;
		}).cl_bind(this));

		this.updateCursorCoordinates = function(adjustScrollParam) {
			adjustScroll = adjustScroll || adjustScrollParam;
			debouncedUpdateCursorCoordinates();
		};

		var oldSelectionRange;

		function checkSelection(selectionRange) {
			if (!oldSelectionRange ||
				oldSelectionRange.startContainer !== selectionRange.startContainer ||
				oldSelectionRange.startOffset !== selectionRange.startOffset ||
				oldSelectionRange.endContainer !== selectionRange.endContainer ||
				oldSelectionRange.endOffset !== selectionRange.endOffset
			) {
				oldSelectionRange = selectionRange;
				self.$trigger('selectionChanged', self.selectionStart, self.selectionEnd, selectionRange);
				return true;
			}
		}

		this.restoreSelection = function() {
			var min = Math.min(this.selectionStart, this.selectionEnd);
			var max = Math.max(this.selectionStart, this.selectionEnd);
			var selectionRange = this.createRange(min, max);
			var selection = editor.$window.getSelection();
			selection.removeAllRanges();
			var isBackward = this.selectionStart > this.selectionEnd;
			if (isBackward && selection.extend) {
				var endRange = selectionRange.cloneRange();
				endRange.collapse(false);
				selection.addRange(endRange);
				selection.extend(selectionRange.startContainer, selectionRange.startOffset);
			} else {
				selection.addRange(selectionRange);
			}
			checkSelection(selectionRange);
			return selectionRange;
		};

		var saveLastSelection = debounce(function() {
			lastSelectionStart = self.selectionStart;
			lastSelectionEnd = self.selectionEnd;
		}, 50);

		function setSelection(start, end) {
			if (start === undefined) {
				start = self.selectionStart;
			}
			if (start < 0) {
				start = 0;
			}
			if (end === undefined) {
				end = this.selectionEnd;
			}
			if (end < 0) {
				end = 0;
			}
			self.selectionStart = start;
			self.selectionEnd = end;
			saveLastSelection();
		}

		this.setSelectionStartEnd = function(start, end) {
			setSelection(start, end);
			return this.restoreSelection();
		};

		this.saveSelectionState = (function() {

			// Credit: https://github.com/timdown/rangy
			function arrayContains(arr, val) {
				var i = arr.length;
				while (i--) {
					if (arr[i] === val) {
						return true;
					}
				}
				return false;
			}

			function getClosestAncestorIn(node, ancestor, selfIsAncestor) {
				var p, n = selfIsAncestor ? node : node.parentNode;
				while (n) {
					p = n.parentNode;
					if (p === ancestor) {
						return n;
					}
					n = p;
				}
				return null;
			}

			function getNodeIndex(node) {
				var i = 0;
				while ((node = node.previousSibling)) {
					++i;
				}
				return i;
			}

			function getCommonAncestor(node1, node2) {
				var ancestors = [],
					n;
				for (n = node1; n; n = n.parentNode) {
					ancestors.push(n);
				}

				for (n = node2; n; n = n.parentNode) {
					if (arrayContains(ancestors, n)) {
						return n;
					}
				}

				return null;
			}

			function comparePoints(nodeA, offsetA, nodeB, offsetB) {
				// See http://www.w3.org/TR/DOM-Level-2-Traversal-Range/ranges.html#Level-2-Range-Comparing
				var nodeC, root, childA, childB, n;
				if (nodeA == nodeB) {
					// Case 1: nodes are the same
					return offsetA === offsetB ? 0 : (offsetA < offsetB) ? -1 : 1;
				} else if ((nodeC = getClosestAncestorIn(nodeB, nodeA, true))) {
					// Case 2: node C (container B or an ancestor) is a child node of A
					return offsetA <= getNodeIndex(nodeC) ? -1 : 1;
				} else if ((nodeC = getClosestAncestorIn(nodeA, nodeB, true))) {
					// Case 3: node C (container A or an ancestor) is a child node of B
					return getNodeIndex(nodeC) < offsetB ? -1 : 1;
				} else {
					root = getCommonAncestor(nodeA, nodeB);
					if (!root) {
						throw new Error("comparePoints error: nodes have no common ancestor");
					}

					// Case 4: containers are siblings or descendants of siblings
					childA = (nodeA === root) ? root : getClosestAncestorIn(nodeA, root, true);
					childB = (nodeB === root) ? root : getClosestAncestorIn(nodeB, root, true);

					if (childA === childB) {
						// This shouldn't be possible
						throw module.createError("comparePoints got to case 4 and childA and childB are the same!");
					} else {
						n = root.firstChild;
						while (n) {
							if (n === childA) {
								return -1;
							} else if (n === childB) {
								return 1;
							}
							n = n.nextSibling;
						}
					}
				}
			}

			function save() {
				var selectionStart = self.selectionStart;
				var selectionEnd = self.selectionEnd;
				var selection = editor.$window.getSelection();
				var result;
				if (selection.rangeCount > 0) {
					var selectionRange = selection.getRangeAt(0);
					var node = selectionRange.startContainer;
					if ((contentElt.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_CONTAINED_BY) || contentElt === node) {
						var offset = selectionRange.startOffset;
						if (node.firstChild && offset > 0) {
							node = node.childNodes[offset - 1];
							offset = node.textContent.length;
						}
						var container = node;
						while (node != contentElt) {
							while (node = node.previousSibling) {
								offset += (node.textContent || '').length;
							}
							node = container = container.parentNode;
						}
						var selectionText = selectionRange + '';
						// Fix end of line when only br is selected
						var brElt = selectionRange.endContainer.firstChild;
						if (brElt && brElt.tagName === 'BR' && selectionRange.endOffset === 1) {
							selectionText += '\n';
						}
						if (comparePoints(selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset) == 1) {
							selectionStart = offset + selectionText.length;
							selectionEnd = offset;
						} else {
							selectionStart = offset;
							selectionEnd = offset + selectionText.length;
						}

						if (selectionStart === selectionEnd && selectionStart === editor.getContent().length) {
							// If cursor is after the trailingNode
							selectionStart = --selectionEnd;
							result = self.setSelectionStartEnd(selectionStart, selectionEnd);
						} else {
							setSelection(selectionStart, selectionEnd);
							result = checkSelection(selectionRange);
							result = result || lastSelectionStart !== self.selectionStart; // selectionRange doesn't change when selection is at the start of a section
						}
					}
				}
				return result;
			}

			function saveCheckChange() {
				return save() && (lastSelectionStart !== self.selectionStart || lastSelectionEnd !== self.selectionEnd);
			}

			var nextTickAdjustScroll = false;
			var debouncedSave = debounce(function() {
				self.updateCursorCoordinates(saveCheckChange() && nextTickAdjustScroll);
				// In some cases we have to wait a little longer to see the selection change (Cmd+A on Chrome OSX)
				longerDebouncedSave();
			});
			var longerDebouncedSave = debounce(function() {
				self.updateCursorCoordinates(saveCheckChange() && nextTickAdjustScroll);
				nextTickAdjustScroll = false;
			}, 10);

			return function(debounced, adjustScroll, forceAdjustScroll) {
				if (forceAdjustScroll) {
					lastSelectionStart = undefined;
					lastSelectionEnd = undefined;
				}
				if (debounced) {
					nextTickAdjustScroll = nextTickAdjustScroll || adjustScroll;
					return debouncedSave();
				} else {
					save();
				}
			};
		})();

		this.getSelectedText = function() {
			var min = Math.min(this.selectionStart, this.selectionEnd);
			var max = Math.max(this.selectionStart, this.selectionEnd);
			return editor.getContent().substring(min, max);
		};

		this.getCoordinates = function(inputOffset, container, offsetInContainer) {
			if (!container) {
				var offset = this.findContainer(inputOffset);
				container = offset.container;
				offsetInContainer = offset.offsetInContainer;
			}
			var containerElt = container;
			if (!containerElt.hasChildNodes()) {
				containerElt = container.parentNode;
			}
			var isInvisible = false;
			var index = editor.$allElements.indexOf(containerElt);
			while (containerElt.offsetHeight === 0 && index > 0) {
				isInvisible = true;
				containerElt = editor.$allElements[--index];
			}
			var rect,
				contentRect,
				left = 'left';
			if (isInvisible || container.textContent == '\n') {
				rect = containerElt.getBoundingClientRect();
			} else {
				var selectedChar = editor.getContent()[inputOffset];
				var startOffset = {
					container: container,
					offsetInContainer: offsetInContainer
				};
				var endOffset = {
					container: container,
					offsetInContainer: offsetInContainer
				};
				if (inputOffset > 0 && (selectedChar === undefined || selectedChar == '\n')) {
					left = 'right';
					if (startOffset.offsetInContainer === 0) {
						// Need to calculate offset-1
						startOffset = inputOffset - 1;
					} else {
						startOffset.offsetInContainer -= 1;
					}
				} else {
					if (endOffset.offset === container.textContent.length) {
						// Need to calculate offset+1
						endOffset = inputOffset + 1;
					} else {
						endOffset.offsetInContainer += 1;
					}
				}
				var range = this.createRange(startOffset, endOffset);
				rect = range.getBoundingClientRect();
			}
			contentRect = contentElt.getBoundingClientRect();
			return {
				top: Math.round(rect.top - contentRect.top + contentElt.scrollTop),
				height: Math.round(rect.height),
				left: Math.round(rect[left] - contentRect.left + contentElt.scrollLeft)
			};
		};

		this.getClosestWordOffset = function(offset) {
			var offsetStart = 0;
			var offsetEnd = 0;
			var nextOffset = 0;
			editor.getContent().split(/\s/).cl_some(function(word) {
				if (word) {
					offsetStart = nextOffset;
					offsetEnd = nextOffset + word.length;
					if (offsetEnd > offset) {
						return true;
					}
				}
				nextOffset += word.length + 1;
			});
			return {
				start: offsetStart,
				end: offsetEnd
			};
		};
	}

	cledit.SelectionMgr = SelectionMgr;

})(window.cledit);

/* jshint -W084, -W099 */
(function(cledit, diff_match_patch) {

	function UndoMgr(editor, options) {
		cledit.Utils.createEventHooks(this);

		options = ({
			undoStackMaxSize: 200,
			bufferStateUntilIdle: 1000
		}).cl_extend(options || {});

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
		this.setDefaultMode = stateMgr.setDefaultMode.cl_bind(stateMgr);

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
				patches.cl_each(function(patch) {
					patch.diffs.cl_each(function(diff) {
						diff[0] = -diff[0];
					});
				});
			}

			var newContent = diffMatchPatch.patch_apply(patches, content)[0];
			var range = editor.setContent(newContent, true);

			var diffs = diffMatchPatch.diff_main(content, newContent);
			editor.$markers.cl_each(function(marker) {
				marker.adjustOffset(diffs);
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

(function(cledit) {

	var Utils = {
		isGecko: 'MozAppearance' in document.documentElement.style,
		isWebkit: 'WebkitAppearance' in document.documentElement.style,
		isMsie: 'msTransform' in document.documentElement.style
	};

	// Faster than setTimeout(0). Credit: http://dbaron.org/log/20100309-faster-timeouts
	Utils.defer = (function() {
		var timeouts = [];
		var messageName = 'deferMsg';
		window.addEventListener('message', function(evt) {
			if (evt.source == window && evt.data == messageName) {
				evt.stopPropagation();
				if (timeouts.length > 0) {
					timeouts.shift()();
				}
			}
		}, true);
		return function(fn) {
			timeouts.push(fn);
			window.postMessage(messageName, "*");
		};
	})();

	Utils.debounce = function(func, wait) {
		var timeoutId, isExpected;
		return wait ?
			function() {
				clearTimeout(timeoutId);
				timeoutId = setTimeout(func, wait);
			} :
			function() {
				if (!isExpected) {
					isExpected = true;
					Utils.defer(function() {
						isExpected = false;
						func();
					});
				}
			};
	};

	Utils.createEventHooks = function(object) {
		var listenerMap = {};
		object.$trigger = function(eventType) {
			var listeners = listenerMap[eventType];
			if (listeners) {
				var args = Array.prototype.slice.call(arguments, 1);
				listeners.cl_each(function(listener) {
					try {
						listener.apply(object, args);
					} catch (e) {}
				});
			}
		};
		object.on = function(eventType, listener) {
			var listeners = listenerMap[eventType];
			if (!listeners) {
				listeners = [];
				listenerMap[eventType] = listeners;
			}
			listeners.push(listener);
		};
		object.off = function(eventType, listener) {
			var listeners = listenerMap[eventType];
			if (listeners) {
				var index = listeners.indexOf(listener);
				if (index > -1) {
					listeners.splice(index, 1);
				}
			}
		};
	};

	Utils.findContainer = function(elt, offset) {
		var containerOffset = 0,
			container;
		do {
			container = elt;
			elt = elt.firstChild;
			if (elt) {
				do {
					var len = elt.textContent.length;
					if (containerOffset <= offset && containerOffset + len > offset) {
						break;
					}
					containerOffset += len;
				} while ((elt = elt.nextSibling));
			}
		} while (elt && elt.firstChild && elt.nodeType !== 3);
		if (elt) {
			return {
				container: elt,
				offsetInContainer: offset - containerOffset
			};
		}
		while (container.lastChild) {
			container = container.lastChild;
		}
		return {
			container: container,
			offsetInContainer: container.nodeType === 3 ? container.textContent.length : 0
		};
	};

	cledit.Utils = Utils;

})(window.cledit);

(function(cledit) {

	function Watcher(editor, listener) {
		this.isWatching = false;
		var contentObserver;
		this.startWatching = function() {
			this.stopWatching();
			this.isWatching = true;
			contentObserver = new MutationObserver(listener);
			contentObserver.observe(editor.$contentElt, {
				childList: true,
				subtree: true,
				characterData: true
			});
		};
		this.stopWatching = function() {
			if(contentObserver) {
				contentObserver.disconnect();
				contentObserver = undefined;
			}
			this.isWatching = false;
		};
		this.noWatch = function(cb) {
			if(this.isWatching === true) {
				this.stopWatching();
				cb();
				return this.startWatching();
			}
			cb();
		};
	}

	cledit.Watcher = Watcher;

})(window.cledit);
