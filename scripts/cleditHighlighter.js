(function(cledit) {

	function Highlighter(editor) {
		var escape = cledit.Utils.escape;

		function highlight(section) {
			var text = escape(section.text);
			text = cledit.Prism.highlight(text, editor.options.language);
			text = text.replace(/\n/gm, '<span class="lf">\n</span>');
			/*
			 var frontMatter = section.textWithFrontMatter.substring(0, section.textWithFrontMatter.length - section.text.length);
			 if(frontMatter.length) {
			 // Front matter highlighting
			 frontMatter = escape(frontMatter);
			 frontMatter = frontMatter.replace(/\n/g, '<span class="token lf">\n</span>');
			 text = '<span class="token md">' + frontMatter + '</span>' + text;
			 }
			 */
			var sectionElt = document.createElement('span');
			sectionElt.id = 'classeur-editor-section-' + section.id;
			sectionElt.className = 'classeur-editor-section';
			sectionElt.generated = true;
			sectionElt.innerHTML = text;
			section.elt = sectionElt;
		}

		var contentElt = editor.$contentElt;
		var sectionCounter = 0;
		this.trailingLfElt;
		this.isComposing = 0;

		var sectionList = [];
		var sectionsToRemove = [];
		var modifiedSections = [];
		var insertBeforeSection;

		this.addTrailingLfElt = function() {
			this.trailingLfElt = document.createElement('span');
			this.trailingLfElt.className = 'lf';
			this.trailingLfElt.textContent = '\n';
			contentElt.appendChild(this.trailingLfElt);
		};

		this.parseSections = function(content, isInit) {
			var tmpText = content + "\n\n";
			var newSectionList = [];
			var offset = 0;

			function addSection(startOffset, endOffset) {
				var sectionText = tmpText.substring(offset, endOffset);
				newSectionList.push({
					id: ++sectionCounter,
					text: sectionText
				});
			}

			// Look for delimiters
			editor.options.sectionDelimiter && tmpText.replace(editor.options.sectionDelimiter, function(match, matchOffset) {
				// Create a new section with the text preceding the delimiter
				addSection(offset, matchOffset);
				offset = matchOffset;
			});

			// Last section
			addSection(offset, content.length);

			modifiedSections = [];
			sectionsToRemove = [];
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

			if(this.isComposing) {
				return sectionList;
			}

			var newSectionEltList = document.createDocumentFragment();
			modifiedSections.forEach(function(section) {
				highlight(section);
				newSectionEltList.appendChild(section.elt);
			});
			editor.watcher.noWatch((function() {
				if(isInit) {
					contentElt.innerHTML = '';
					contentElt.appendChild(newSectionEltList);
					return this.addTrailingLfElt();
				}

				// Remove outdated sections
				sectionsToRemove.forEach(function(section) {
					// section may be already removed
					section.elt.parentNode === contentElt && contentElt.removeChild(section.elt);
					// To detect sections that come back with built-in undo
					section.elt.generated = false;
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
					if(!childNode.generated) {
						contentElt.removeChild(childNode);
					}
					childNode = nextNode;
				}
				this.addTrailingLfElt();
				editor.selectionMgr.restoreSelection();
				editor.selectionMgr.updateCursorCoordinates();
			}).bind(this));

			return sectionList;
		};
	}

	cledit.Highlighter = Highlighter;

})(window.cledit);
