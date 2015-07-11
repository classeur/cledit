# cledit
Classeur ContentEditable engine

This library is the module powering Classeur's file editor. It's based on [StackEdit](https://stackedit.io)'s editor module, which is itself based on the editor implemented in [Dabblet](http://dabblet.com/).

The main purpose is to have a lightweight layer on top of a built-in contenteditable text field, providing the following features:

- Syntax highlighting
- Selection getter, setter, change listener, cursor coordinates calculation...
- Custom undo/redo management
- Custom keystrokes

The benefits over ACE/CodeMirror are:

- Pluggable syntax highlighting (works beautifully with [Prism.js](http://prismjs.com/))
- Browser built-in spellchecking
- Mobile device support

cledit relies on browsers built-in MutationObserver API, so IE11+ is required.  
cledit uses Google's [DiffMatchPatch library](https://code.google.com/p/google-diff-match-patch/) as a dependency.
A usage example can be found in the `demo` folder.
