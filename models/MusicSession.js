const { AudioPlayerStatus, createAudioPlayer, createAudioResource, joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const fs = require('fs');
const ytdl = require('ytdl-core-discord');
// const { FFmpegCommand, FFmpegInput, FFmpegOutput } = require('@tedconf/fessonia')();
// const { v4: uuidv4 } = require('uuid');

const ytdlOptions = {
	filter: 'audioonly',
	quality: 'highestaudio',
	highWaterMark: 1 << 28,
	quiet: true,
	no_warnings: true,
};

class MusicSession {
	constructor(channel) {
		this.queue = [];
		this.queueHistory = [];
		this.player = createAudioPlayer();
		this.resource = undefined;

		this.channel = channel;
		this.connection = undefined;
		this.inactivityTimeout = undefined;

		this.currentVideo = undefined;
		this.currentStream = undefined;

		this.player.on('stateChange', (oldState, newState) => {
			if (oldState.status === AudioPlayerStatus.Playing && newState.status === AudioPlayerStatus.Idle) {
				if (this.queue.length > 0) {
					// this.removeCurrentMediaFile();
					this.playVideo(this.getNextVideo());
				}
				else {
					this.currentVideo = undefined;
					this.currentStream = undefined;
					this.resource = undefined;

					this.inactivityTimeout = setTimeout(() => {
						this.queueHistory[this.queueHistory.length - 1].getMessage().channel.send('I will make my leave here, type `-join` or play something to start a new session. I have an idle time of 5 minutes.');
						this.connection.destroy();
					}, (5 * 60 * 1000));
				}
			}
		});

		this.connect()
			.then(connection => {
				connection.subscribe(this.player);
			})
			// TODO: Maybe something to reconnect?
			.catch(console.warn);
	}

	removeCurrentMediaFile() {
		const filename = this.currentVideo.getMediaFilename();
		for (const format in ['.webm', '-s.webm']) {
			try {
				fs.unlinkSync('.\\media_cache\\' + filename + format);
			}
			catch (err) {
				console.warn(err);
			}
		}
	}

	play(video) {
		clearTimeout(this.inactivityTimeout);
		if (this.player.state.status === AudioPlayerStatus.Idle && this.currentVideo === undefined) {
			this.playVideo(video);
		}
		else {
			this.queue.push(video);
		}
	}

	getNextVideo() {
		this.queueHistory.push(this.currentVideo);
		const video = this.queue.shift();
		this.currentVideo = video;
		return this.currentVideo;
	}

	async playVideo(video) {
		this.currentVideo = video;
		this.currentVideo.getMessage().channel.send('Playing `' + this.currentVideo.getTitle() + '`.');

		// standard method
		this.currentStream = await ytdl(this.currentVideo.getUrl(), ytdlOptions);
		this.resource = createAudioResource(this.currentStream);
		this.player.play(this.resource);

		// const newMediaFilename = uuidv4().toString();
		// this.currentVideo.setMediaFilename(newMediaFilename);
		// ytdl(this.currentVideo.getUrl(), ytdlOptions)
		// 	.pipe(fs.createWriteStream('.\\media_cache\\' + this.currentVideo.getMediaFilename() + '.webm'))
		// 	.on('finish', () => {
		// 		this.resource = createAudioResource('.\\media_cache\\' + this.currentVideo.getMediaFilename() + '.webm', { inputType: StreamType.WebmOpus });
		// 		this.player.play(this.resource);
		// 	});
	}

	async seek(seekTime) {
		console.log(seekTime);

		// const ffin = new FFmpegInput('.\\media_cache\\' + this.currentVideo.getMediaFilename() + '.webm');
		// const ffout = new FFmpegOutput('.\\media_cache\\' + this.currentVideo.getMediaFilename() + '-s.webm', {
		// 	'c:a': 'copy',
		// 	'ss': seekTime,
		// });

		// const cmd = new FFmpegCommand();
		// cmd.addInput(ffin);
		// cmd.addOutput(ffout);

		// cmd.on('update', () => {
		// 	// console.log(`Received update on ffmpeg process:`, data);
		// 	// handle the update here
		// });

		// cmd.on('success', () => {
		// 	// when the media processing is done
		// 	// assert(data.exitCode === 0);
		// 	// assert(data.hasOwnProperty('progress'));
		// 	// assert(data.progress.hasOwnProperty('progressData'));
		// 	// console.log(`Completed successfully with exit code ${data.exitCode}`, data.progress.progressData);

		// 	// handle the success here
		// 	this.resource = createAudioResource('.\\media_cache\\' + this.currentVideo.getMediaFilename() + '-s.webm', { inputType: StreamType.WebmOpus });
		// 	this.player.play(this.resource);
		// });

		// cmd.on('error', (err) => {
		// 	console.log(err.message, err.stack);
		// 	// inspect and handle the error here
		// });

		// cmd.spawn();
		// this.currentStream2 = await ytdl(this.currentVideo.getUrl(), ytdlOptions);

		// const transcoder = new prism.FFmpeg({
		// 	args: [
		// 		'-analyzeduration', '0',
		// 		'-loglevel', '0',
		// 		'-c:a', 'copy',
		// 		'-ss', seekTime,
		// 	],
		// });

		// const pipe2 = this.currentStream2.pipe(transcoder);
	}

	skip() {
		this.player.stop();
	}

	pause() {
		this.player.pause();
	}

	unpause() {
		this.player.unpause();
	}

	async connect() {
		this.connection = joinVoiceChannel({
			channelId: this.channel.id,
			guildId: this.channel.guild.id,
			adapterCreator: this.channel.guild.voiceAdapterCreator,
		});

		try {
			entersState(this.connection, VoiceConnectionStatus.Ready, 30e3);
			return this.connection;
		}
		catch (error) {
			this.connection.destroy();
			throw error;
		}
	}

	remove(index, message) {
		if (index <= this.queue.length) {
			this.queue.splice(index - 1, 1);
			// TODO: make the message a lil nicer
			return message.channel.send('Removed Song #' + index + ' from the queue');
		}
		else {
			return message.channel.send('No such music in queue.');
		}
	}

	leave() {
		if (this.connection !== undefined) {
			this.connection.destroy();
		}
	}

	getQueue() {
		return this.queue;
	}

	getQueueHistory() {
		return this.queueHistory;
	}

	getPlayerStatus() {
		return this.player.state.status;
	}

	getPlayerDuration() {
		return this.resource.playbackDuration;
	}

	clear() {
		this.queue.clear();
		this.queueHistory.clear();
		this.player.stop();
	}
}

module.exports = MusicSession;