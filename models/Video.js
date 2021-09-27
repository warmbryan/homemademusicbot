class Video {
	constructor(vId, vTitle, vMessage) {
		this.id = vId;
		this.title = vTitle;
		this.message = vMessage;
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

	getMessage() {
		return this.message;
	}
}

module.exports = Video;