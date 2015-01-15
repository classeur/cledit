# cledit
Classeur ContentEditable engine

This project is the module powering Classeur's editor. It's based on [StackEdit](https://stackedit.io)'s editor module, which is itself based on the editor implemented in [Dabblet](http://dabblet.com/).

The goal is to have a lightweight library on top of a built-in contenteditable text field. The benefit over ACE/CodeMirror are:

- Beautiful syntax highlighting
- Browser built-in spellchecking
- Mobile device support

cledit provides the following features:

- Syntax highlighting (a custom version of [Prism.js](http://prismjs.com/) is included, supporting Prism language definitions)
- Performance enhancements (splitting the file in multiple sections is the key concept)
- Text selection getter, setter, change listener, cursor coordinates detection...
- Better undo/redo management
- Customizable keystrokes

cledit relies on browsers built-in MutationObserver API, so IE11+ is required.
cledit uses Google's [DiffMatchPatch library](https://code.google.com/p/google-diff-match-patch/) as a dependency.
Usage examples can be found in the `examples` folder.
