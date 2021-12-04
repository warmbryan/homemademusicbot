const path = require('path');
const { unlinkSync } = require('fs');
const { media_tmp_path } = require('../config.json');

class Video {
	constructor(vId, vTitle, vMessage) {
		this.id = vId;
		this.title = vTitle;
		this.message = vMessage;
		this.mediaFileModifications = new Array();
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

	setMediaFilename(vMediaFilename) {
		this.mediaFilename = vMediaFilename;
	}

	getMediaFilename() {
		return this.mediaFilename;
	}

	addModifiedMediaFilename(modifiedMediaFilename) {
		this.mediaFileModifications.push(modifiedMediaFilename);
	}

	getModifiedMediaFilenames() {
		return this.mediaFileModifications;
	}

	// clears the modified media
	clear() {
		try {
			const originalFilenamePath = path.join(media_tmp_path, this.mediaFilename);
			unlinkSync(originalFilenamePath);

			this.mediaFileModifications.map(filename => {
				const filenamePath = path.join(media_tmp_path, filename);
				unlinkSync(filenamePath);
			});
		}
		catch (error) {
			console.error(error);
		}
	}
}

module.exports = Video;