var editor = window.cledit(
	document.querySelector('.content'),
	// Optional (pass a second arg if scrollbar is not on the first arg)
	document.querySelector('.scroller')
);
var prismGrammar = window.mdGrammar({
	fcbs: true,
	tables: true,
	strikes: true
});
editor.init({
	highlighter: function(text) {
		return Prism.highlight(text, prismGrammar);
	},
	// Optional (increases performance on large documents)
	sectionDelimiter: '^.+[ \\t]*\\n=+[ \\t]*\\n+|^.+[ \\t]*\\n-+[ \\t]*\\n+|^\\#{1,6}[ \\t]*.+?[ \\t]*\\#*\\n+'
});
