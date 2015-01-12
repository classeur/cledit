(function(cledit) {

	var Utils = {
		isGecko: 'MozAppearance' in document.documentElement.style,
		isWebkit: 'WebkitAppearance' in document.documentElement.style,
		isMsie: 'msTransform' in document.documentElement.style
	};

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

	Utils.createEventHooks = function(object) {
		var listenerMap = {};
		object.$trigger = function(eventType) {
			var listeners = listenerMap[eventType];
			if(listeners) {
				var args = Array.prototype.slice.call(arguments, 1);
				listeners.forEach(function(listener) {
					try {
						listener.apply(object, args);
					}
					catch(e) {
					}
				});
			}
		};
		object.on = function(eventType, listener) {
			var listeners = listenerMap[eventType];
			if(!listeners) {
				listeners = [];
				listenerMap[eventType] = listeners;
			}
			listeners.push(listener);
		};
		object.off = function(eventType, listener) {
			var listeners = listenerMap[eventType];
			if(listeners) {
				var index = listeners.indexOf(listener);
				if(index > -1) {
					listeners.splice(index, 1);
				}
			}
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

	cledit.Utils = Utils;

})(window.cledit);
