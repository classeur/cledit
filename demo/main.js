var editor = window.cledit(
	document.querySelector('.content'),
	// Optional (pass a second arg if scrollbar is not on the first arg)
	document.querySelector('.scroller')
);
var prismGrammar = window.mdGrammar({
	fences: true,
	tables: true,
	footnotes: true,
	abbrs: true,
	deflists: true,
	tocs: true,
	dels: true,
	subs: true,
	sups: true,
});
editor.init({
	highlighter: function(text) {
		return Prism.highlight(text, prismGrammar);
	},
	// Optional (increases performance on large documents)
	sectionParser: function(text) {
		var offset = 0, sectionList = [];
		(text + '\n\n').replace(/^.+[ \t]*\n=+[ \t]*\n+|^.+[ \t]*\n-+[ \t]*\n+|^\#{1,6}[ \t]*.+?[ \t]*\#*\n+/gm, function(match, matchOffset) {
			sectionList.push(text.substring(offset, matchOffset));
			offset = matchOffset;
		});
		sectionList.push(text.substring(offset));
		return sectionList;
	}
});
