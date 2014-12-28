(function(ced) {

	function Watcher(editor, listener) {
		this.isWatching = false;
		var contentObserver;
		this.startWatching = function() {
			this.isWatching = true;
			contentObserver = contentObserver || new MutationObserver(listener);
			contentObserver.observe(editor.$contentElt, {
				childList: true,
				subtree: true,
				characterData: true
			});
		};
		this.stopWatching = function() {
			contentObserver.disconnect();
			this.isWatching = false;
		};
		this.noWatch = function(cb) {
			if(this.isWatching === true) {
				this.stopWatching();
				cb();
				return this.startWatching();
			}
			cb();
		};
	}

	ced.Watcher = Watcher;

})(window.ced);
