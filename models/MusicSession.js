const {
	AudioPlayerStatus,
	VoiceConnectionStatus,
	createAudioPlayer,
	createAudioResource,
	joinVoiceChannel,
	entersState,
	getVoiceConnection,
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const fs = require('fs');

const { ytdlp_launch_command } = require('../config.json');

// const { FFmpegCommand, FFmpegInput, FFmpegOutput } = require('@tedconf/fessonia')();

const ytdl = require('ytdl-core-discord');
const { v4: uuidv4 } = require('uuid');

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

		this.channelId = channel.id;

		this.player.on('stateChange', (oldState, newState) => {
			if (oldState.status === AudioPlayerStatus.Playing && newState.status === AudioPlayerStatus.Idle) {
				this.removeCurrentMediaFile();
				if (this.queue.length > 0) {
					this.playVideo(this.getNextVideo());
				}
				else {
					this.currentVideo = undefined;
					this.currentStream = undefined;
					this.resource = undefined;

					this.inactivityTimeout = setTimeout(async () => {
						try {
							if (this.queueHistory.length > 0) {
								const lastPlayedMedia = this.queueHistory.pop();
								const messageObj = lastPlayedMedia.getMessage();
								await messageObj.channel.send('I will make my leave here, type `-join` or play something to start a new session. I have an idle time of 5 minutes.');
							}
						}
						catch (e) {
							console.warn(e);
						}
						finally {
							this.connection.destroy();
						}
					}, (5 * 60 * 1000));
				}
			}
		});

		this.join();
	}

	getLastVideo() {
		if (this.queueHistory.length) {
			return this.queueHistory[this.queueHistory.length - 1];
		}
		return null;
	}

	removeCurrentMediaFile() {
		const fileName = this.currentVideo.getMediaFilename();
		try {
			fs.unlinkSync('.\\temp_media\\' + fileName);
		}
		catch (err) {
			// console.warn(err);
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
		this.join();
		this.currentVideo = video;
		this.currentVideo.getMessage().channel.send('Playing `' + this.currentVideo.getTitle() + '`.');

		// standard method
		try {
			this.currentStream = await ytdl(this.currentVideo.getUrl(), ytdlOptions);
			this.currentVideo.setMediaFilename(uuidv4().toString());
			this.resource = createAudioResource(this.currentStream);
			this.player.play(this.resource);
		}
		catch (exception) {
			this.currentVideo.getMessage().channel.send('Something went wrong. Probably age restricted or blocked video. Fix coming soon.');
			this.player.stop();
			console.warn(exception);
		}
	}

	play2(video) {
		clearTimeout(this.inactivityTimeout);
		if (this.player.state.status === AudioPlayerStatus.Idle && this.currentVideo === undefined) {
			this.playVideo2(video);
		}
		else {
			this.queue.push(video);
		}
	}

	async playVideo2(video) {
		this.join();
		this.currentVideo = video;

		try {
			let fileName = uuidv4().toString();
			const examineMediaUrl = spawn(ytdlp_launch_command, ['-f', '250/bestaudio[acodec=opus]/bestaudio', '-o', `temp_media/${fileName}.%(ext)s`, this.currentVideo.getUrl()]);
			examineMediaUrl.stdout.on('data', (data) => {
				const message = data.toString().trim();
				const matchResult = message.match(/\[download\] Destination: temp_media\\(?<fileName>[-0-9a-z]{36}\.[a-z0-9]+)/);
				if (matchResult && matchResult.groups?.fileName) {
					fileName = matchResult.groups?.fileName;
				}
			});

			examineMediaUrl.stderr.on('data', (data) => {
				console.warn(data.toString());
			});

			examineMediaUrl.on('close', () => {
				// console.log('child process closed.');
				this.resource = createAudioResource('temp_media/' + fileName);
				this.player.play(this.resource);
			});
		}
		catch (exception) {
			this.currentVideo.getMessage().channel.send('Something went wrong.');
			this.player.stop();
			console.warn(exception);
		}
	}

	// async seek(seekTime) {
	// 	console.log('seeked:', seekTime);
	// 	ytdl2(this.currentVideo.getUrl(), ytdlOptions)
	// 		.pipe(fs.createWriteStream('.\\media_cache\\' + this.currentVideo.getMediaFilename() + '.webm'))
	// 		.on('finish', () => {
	// 			const file = fs.createReadStream('.\\media_cache\\' + this.currentVideo.getMediaFilename() + '.webm');
	// 			const transcoder = new prism.FFmpeg({
	// 				args: [
	// 					'-analyzeduration', '0',
	// 					'-loglevel', '0',
	// 					'-f', 's16le',
	// 					'-ar', '48000',
	// 					'-ac', '2',
	// 					'-ss', seekTime,
	// 				],
	// 			});

	// 			const seekedFile = file.pipe(transcoder);
	// 			const encodedFile = seekedFile.pipe(new prism.opus.Encoder({ rate: 48000, channels: 2, frameSize: 960 }));
	// 			this.resource = createAudioResource(encodedFile);
	// 			this.player.play(this.resource);
	// 		});
	// }

	// skips the current playing song
	skip() {
		this.player.stop();
		// this.currentVideo.getMessage().channel.send()
	}

	// pause the player
	pause() {
		this.player.pause();
	}

	// unpause the player
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

	join() {
		try {
			const newConnection = getVoiceConnection(this.channel.guild.id);
			if (newConnection === undefined) {
				this.connect()
					.then(connection => {
						connection.subscribe(this.player);
					})
					.catch(console.warn);
			}
		}
		catch (error) {
			console.warn(error);
		}
	}

	// removes a song from the upcoming queue
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

	// clears the player queue and stops the player
	clear() {
		this.queue = [];
		this.queueHistory = [];
		this.player.stop();
	}

	back() {
		this.queue.unshift(this.currentVideo);
		const previousSong = this.queueHistory.pop();
		this.playVideo(previousSong);
		return previousSong;
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

	getCurrentVideo() {
		return this.currentVideo;
	}
}

module.exports = MusicSession;