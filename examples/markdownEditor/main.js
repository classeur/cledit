window.rangy.init();
var editor = window.cledit(
	document.querySelector('pre'),
	// Optional (pass a second arg if scrollbar is not on the first arg)
	document.body
);
editor.init({
	language: window.mdGrammar({
		fcbs: true,
		tables: true,
		strikes: true
	}),
	// Optional (increases performance on large documents)
	sectionDelimiter: '^.+[ \\t]*\\n=+[ \\t]*\\n+|^.+[ \\t]*\\n-+[ \\t]*\\n+|^\\#{1,6}[ \\t]*.+?[ \\t]*\\#*\\n+'
});
