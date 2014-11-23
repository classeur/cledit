(function(ced) {

	var Utils = {};

	// Faster than setTimeout (see http://dbaron.org/log/20100309-faster-timeouts)
	Utils.defer = (function() {
		var timeouts = [];
		var messageName = 'deferMsg';
		window.addEventListener('message', function(evt) {
			if(evt.source == window && evt.data == messageName) {
				evt.stopPropagation();
				if(timeouts.length > 0) {
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
		var timeoutId, isExpected = false;
		return wait ?
			function() {
				clearTimeout(timeoutId);
				timeoutId = setTimeout(func, wait);
			} :
			function() {
				if(isExpected === true) {
					return;
				}
				isExpected = true;
				Utils.defer(function() {
					isExpected = false;
					func();
				});
			};
	};

	Utils.createHook = function(object, name) {
		var listeners = [];
		object[name] = function(listener) {
			listeners.push(listener);
		};
		return function() {
			var args = arguments;
			listeners.forEach(function(listener) {
				listener.apply(null, args);
			});
		};
	};

	Utils.extend = function(object, options) {
		Object.keys(options).map(function(prop) {
			object[prop] = options[prop];
		});
		return object;
	};

	Utils.escape = (function() {
		var entityMap = {
			"&": "&amp;",
			"<": "&lt;",
			"\u00a0": ' '
		};
		return function(str) {
			return str.replace(/[&<\u00a0]/g, function(s) {
				return entityMap[s];
			});
		};
	})();

	ced.Utils = Utils;

})(window.ced);
