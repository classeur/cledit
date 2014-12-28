/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */

(function(ced) {

	var Prism = {
		highlight: function(text, grammar, language) {
			return Token.stringify(Prism.tokenize(text, grammar), language);
		},

		tokenize: function(text, grammar) {
			var strarr = [text];
			var rest = grammar.rest;
			var token;

			if(rest) {
				for(token in rest) {
					grammar[token] = rest[token];
				}
				delete grammar.rest;
			}

			tokenloop: for(token in grammar) {
				if(!grammar.hasOwnProperty(token) || !grammar[token]) {
					continue;
				}

				var pattern = grammar[token],
					inside = pattern.inside,
					lookbehind = !!pattern.lookbehind,
					lookbehindLength = 0;

				pattern = pattern.pattern || pattern;

				for(var i = 0; i < strarr.length; i++) { // Don’t cache length as it changes during the loop

					var str = strarr[i];

					if(strarr.length > text.length) {
						// Something went terribly wrong, ABORT, ABORT!
						break tokenloop;
					}

					if(str instanceof Token) {
						continue;
					}

					pattern.lastIndex = 0;
					var match = pattern.exec(str);
					if(match) {
						if(lookbehind) {
							lookbehindLength = match[1].length;
						}

						var from = match.index - 1 + lookbehindLength;
						match = match[0].slice(lookbehindLength);
						var len = match.length,
							to = from + len,
							before = str.slice(0, from + 1),
							after = str.slice(to + 1);

						var args = [
							i,
							1
						];
						if(before) {
							args.push(before);
						}

						var wrapped = new Token(token, inside ? Prism.tokenize(match, inside) : match);
						args.push(wrapped);
						if(after) {
							args.push(after);
						}
						Array.prototype.splice.apply(strarr, args);
					}
				}
			}
			return strarr;
		}
	};

	function Token(type, content) {
		this.type = type;
		this.content = content;
	}

	Token.stringify = function(o, language, parent) {
		if(typeof o == 'string') {
			return o;
		}

		if(Object.prototype.toString.call(o) == '[object Array]') {
			return o.map(function(element) {
				return Token.stringify(element, language, o);
			}).join('');
		}

		var env = {
			type: o.type,
			content: Token.stringify(o.content, language, parent),
			tag: 'span',
			classes: [
				'token',
				o.type
			],
			attributes: {},
			language: language,
			parent: parent
		};

		if(env.type == 'comment') {
			env.attributes.spellcheck = 'true';
		}

		var attributes = '';
		for(var name in env.attributes) {
			attributes += name + '="' + (env.attributes[name] || '') + '"';
		}

		return '<' + env.tag + ' class="' + env.classes.join(' ') + '" ' + attributes + '>' + env.content + '</' + env.tag + '>';
	};

	ced.Prism = Prism;

})(window.ced);
