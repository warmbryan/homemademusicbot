class Video {
	constructor(vId, vTitle) {
		this.id = vId;
		this.title = vTitle;
	}

	getId() {
		return this.id;
	}

	getUrl() {
		return 'https://www.youtube.com/watch?v=' + this.id;
	}

	getTitle() {
		return this.title;
	}
}

module.exports = Video;