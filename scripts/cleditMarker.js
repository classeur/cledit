(function(cledit) {

	var DIFF_DELETE = -1;
	var DIFF_INSERT = 1;
	var DIFF_EQUAL = 0;

	function Marker(offset) {
		this.offset = offset;
	}

	Marker.prototype.adjustOffset = function(diffs) {
		var startOffset = 0;
		diffs.forEach(function(diff) {
			var diffType = diff[0];
			var diffText = diff[1];
			var diffOffset = diffText.length;
			switch (diffType) {
				case DIFF_EQUAL:
					startOffset += diffOffset;
					break;
				case DIFF_INSERT:
					if (this.offset >= startOffset) {
						this.offset += diffOffset;
					}
					startOffset += diffOffset;
					break;
				case DIFF_DELETE:
					if (this.offset > startOffset) {
						diffOffset = Math.min(diffOffset, this.offset - startOffset);
						startOffset += diffOffset;
					}
					break;
			}
		});
	};

	cledit.Marker = Marker;

})(window.cledit);
