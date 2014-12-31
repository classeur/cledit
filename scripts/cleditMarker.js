(function(cledit) {

	function Marker(offset) {
		this.offset = offset;
	}

	Marker.prototype.adjustOffset = function(patch) {
		var diffOffset = patch.text.length;
		if(patch.insert && this.offset >= patch.offset) {
			this.offset += diffOffset;
		}
		else if(!patch.insert && this.offset > patch.offset) {
			diffOffset = Math.min(diffOffset, this.offset - patch.offset);
			this.offset -= diffOffset;
		}
	};

	cledit.Marker = Marker;

})(window.cledit);
