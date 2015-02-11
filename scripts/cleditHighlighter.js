(function(cledit) {

	function Highlighter(editor) {
		var escape = cledit.Utils.escape;
		var self = this;
		cledit.Utils.createEventHooks(this);

		var contentElt = editor.$contentElt;
		var sectionCounter = 0;
		this.isComposing = 0;

		var sectionList = [];
		var insertBeforeSection;
		var wrapEmptyLines = cledit.Utils.isWebkit;
		var useBr = cledit.Utils.isGecko || cledit.Utils.isWebkit;
		var trailingNodeTag = 'div';
		var hiddenLfInnerHtml = '<br><span class="hd-lf" style="display: none">\n</span>';

		var lfHtml = '<span class="lf">' + (useBr ? hiddenLfInnerHtml : '\n') + '</span>';

		this.fixContent = function(modifiedSections, removedSections, mutations) {
			modifiedSections.forEach(function(section) {
				section.hiddenLfEltList && Array.prototype.forEach.call(section.hiddenLfEltList, function(lfElt) {
					if(!lfElt.previousSibling) {
						lfElt.parentNode.removeChild(lfElt);
					}
				});
				section.brEltList && Array.prototype.forEach.call(section.brEltList, function(brElt) {
					if(brElt.parentNode.className !== 'lf') {
						var lfElt = editor.$document.createElement('span');
						lfElt.innerHTML = hiddenLfInnerHtml;
						brElt.parentNode.replaceChild(lfElt, brElt);
					}
					else if(!brElt.nextSibling) {
						var hiddenLfElt = editor.$document.createElement('span');
						hiddenLfElt.className = 'hd-lf';
						hiddenLfElt.textContent = '\n';
						hiddenLfElt.style.display = 'none';
						brElt.parentNode.appendChild(hiddenLfElt);
					}
				});
				section.divEltList && Array.prototype.forEach.call(section.divEltList, function(elt) {
					if(elt.previousSibling && elt.previousSibling.textContent && elt.previousSibling.textContent.slice(-1) !== '\n') {
						elt.parentNode.insertBefore(editor.$document.createTextNode('\n'), elt);
					}
				});
				if(section.elt.textContent.slice(-1) !== '\n') {
					section.elt.appendChild(editor.$document.createTextNode('\n'));
				}
			});
			if(cledit.Utils.isMsie && editor.getContent() === contentElt.textContent) {
				// In IE, backspace can provoke section merging without any actual text modification
				var mergedSections = [];
				var addedNode;
				mutations.forEach(function(mutation) {
					var node;
					if(mutation.removedNodes.length === 1) {
						node = mutation.removedNodes[0];
						node.section && mergedSections.push(node.section);
					}
					if(mutation.addedNodes.length === 1) {
						addedNode = mutation.addedNodes[0];
					}
				});
				if(addedNode && mergedSections.length === 2) {
					var index1 = sectionList.indexOf(mergedSections[0]);
					var index2 = sectionList.indexOf(mergedSections[1]);
					var firstSection = sectionList[Math.min(index1, index2)];
					var secondSection = sectionList[Math.max(index1, index2)];
					if(firstSection.text.slice(-1) === '\n') {
						editor.selectionMgr.saveSelectionState();
						addedNode.textContent = firstSection.text.slice(0, -1) + secondSection.text;
						editor.selectionMgr.selectionStart--;
						editor.selectionMgr.selectionEnd--;
						return true;
					}
				}
			}
			this.$trigger('domChanged', modifiedSections, removedSections, mutations);
		};

		this.addTrailingNode = function() {
			this.trailingNode = editor.$document.createElement(trailingNodeTag);
			contentElt.appendChild(this.trailingNode);
		};

		function Section(text) {
			this.id = ++sectionCounter;
			this.text = text;
		}

		Section.prototype.setElement = function(elt) {
			this.elt = elt;
			elt.section = this;

			// Live collections
			if(useBr) {
				this.hiddenLfEltList = elt.getElementsByClassName('hd-lf');
				this.brEltList = elt.getElementsByTagName('br');
			}
			if(wrapEmptyLines) {
				this.divEltList = elt.getElementsByTagName('div');
			}
		};

		this.parseSections = function(content, isInit) {
			if(this.isComposing) {
				return sectionList;
			}

			var tmpText = content + "\n\n";
			var newSectionList = [];
			var offset = 0;

			function addSection(startOffset, endOffset) {
				var sectionText = tmpText.substring(offset, endOffset);
				newSectionList.push(new Section(sectionText));
			}

			// Look for delimiters
			editor.options.sectionDelimiter && tmpText.replace(editor.options.sectionDelimiter, function(match, matchOffset) {
				// Create a new section with the text preceding the delimiter
				addSection(offset, matchOffset);
				offset = matchOffset;
			});

			// Last section
			addSection(offset, content.length);

			var modifiedSections = [];
			var sectionsToRemove = [];
			insertBeforeSection = undefined;

			if(isInit) {
				// Render everything if isInit
				sectionsToRemove = sectionList;
				sectionList = newSectionList;
				modifiedSections = newSectionList;
			}
			else {
				// Find modified section starting from top
				var leftIndex = sectionList.length;
				sectionList.some(function(section, index) {
					var newSection = newSectionList[index];
					if(index >= newSectionList.length ||
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
				sectionList.slice().reverse().some(function(section, index) {
					var newSection = newSectionList[newSectionList.length - index - 1];
					if(index >= newSectionList.length ||
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

				if(leftIndex - rightIndex > sectionList.length) {
					// Prevent overlap
					rightIndex = leftIndex - sectionList.length;
				}

				// Create an array composed of left unmodified, modified, right
				// unmodified sections
				var leftSections = sectionList.slice(0, leftIndex);
				modifiedSections = newSectionList.slice(leftIndex, newSectionList.length + rightIndex);
				var rightSections = sectionList.slice(sectionList.length + rightIndex, sectionList.length);
				insertBeforeSection = rightSections[0];
				sectionsToRemove = sectionList.slice(leftIndex, sectionList.length + rightIndex);
				sectionList = leftSections.concat(modifiedSections).concat(rightSections);
			}

			var newSectionEltList = editor.$document.createDocumentFragment();
			modifiedSections.forEach(function(section) {
				highlight(section);
				newSectionEltList.appendChild(section.elt);
			});
			editor.watcher.noWatch((function() {
				if(isInit) {
					contentElt.innerHTML = '';
					contentElt.appendChild(newSectionEltList);
					return this.addTrailingNode();
				}

				// Remove outdated sections
				sectionsToRemove.forEach(function(section) {
					// section may be already removed
					section.elt.parentNode === contentElt && contentElt.removeChild(section.elt);
					// To detect sections that come back with built-in undo
					section.elt.section = undefined;
				});

				if(insertBeforeSection !== undefined) {
					contentElt.insertBefore(newSectionEltList, insertBeforeSection.elt);
				}
				else {
					contentElt.appendChild(newSectionEltList);
				}

				// Remove unauthorized nodes (text nodes outside of sections or duplicated sections via copy/paste)
				var childNode = contentElt.firstChild;
				while(childNode) {
					var nextNode = childNode.nextSibling;
					if(!childNode.section) {
						contentElt.removeChild(childNode);
					}
					childNode = nextNode;
				}
				this.addTrailingNode();
				editor.selectionMgr.restoreSelection();
				editor.selectionMgr.updateCursorCoordinates();
			}).bind(this));

			return sectionList;
		};

		function highlight(section) {
			var text = escape(section.text);
			text = cledit.Prism.highlight(text, editor.options.language);
			if(wrapEmptyLines) {
				text = text.replace(/^\n/gm, '<div>\n</div>');
			}
			text = text.replace(/\n/g, lfHtml);
			/*
			 var frontMatter = section.textWithFrontMatter.substring(0, section.textWithFrontMatter.length - section.text.length);
			 if(frontMatter.length) {
			 // Front matter highlighting
			 frontMatter = escape(frontMatter);
			 frontMatter = frontMatter.replace(/\n/g, '<span class="token lf">\n</span>');
			 text = '<span class="token md">' + frontMatter + '</span>' + text;
			 }
			 */
			var sectionElt = editor.$document.createElement('div');
			sectionElt.id = 'cledit-section-' + section.id;
			sectionElt.className = 'cledit-section';
			sectionElt.innerHTML = text;
			section.setElement(sectionElt);
			self.$trigger('sectionHighlighted', section);

			//section.addTrailingLf();
		}
	}

	cledit.Highlighter = Highlighter;

})(window.cledit);
