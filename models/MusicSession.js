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
const path = require('path');

const { ytdlp_launch_command, media_tmp_path } = require('../config.json');
const { v4: uuidv4 } = require('uuid');

// TODO: reduce redundant code
// path.join moment

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

		this.encoder = undefined;
		this.isEncoding = false;

		this.channelId = channel.id;

		this.player.on('stateChange', (oldState, newState) => {
			if (oldState.status === AudioPlayerStatus.Playing && newState.status === AudioPlayerStatus.Idle) {
				// clear media
				this.currentVideo.clear();

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
		this.currentVideo.getMessage().channel.send('Playing `' + this.currentVideo.getTitle().unescapeHTML() + '`.');

		try {
			let validPlay = false;
			let fileName = uuidv4().toString();
			const examineMediaUrl = spawn(ytdlp_launch_command, ['-f', '250/bestaudio[acodec=opus]/bestaudio', '-o', path.join(media_tmp_path, `${fileName}.%(ext)s`), this.currentVideo.getUrl()]);
			examineMediaUrl.stdout.on('data', (data) => {
				const message = data.toString().trim();
				const matchResult = message.match(/\[download\] Destination: temp_media(\\|\/)(?<fileName>[-0-9a-z]{36}\.[a-z0-9]+)/);
				if (matchResult && matchResult.groups?.fileName) {
					fileName = matchResult.groups?.fileName;
					validPlay = true;
				}
			});

			examineMediaUrl.stderr.on('data', (data) => {
				console.warn(data.toString());
			});

			examineMediaUrl.on('close', () => {
				if (validPlay) {
					// set media filename
					this.currentVideo.setMediaFilename(fileName);

					// play
					this.resource = createAudioResource(path.join(media_tmp_path, fileName));
					this.player.play(this.resource);
				}
			});
		}
		catch (exception) {
			this.currentVideo.getMessage().channel.send('Something went wrong.');
			this.player.stop();
			console.warn(exception);
		}
	}

	seek(seekTime) {
		this.alterCurrentMedia(['-ss', seekTime, '-c:a', 'copy']);
	}

	// alters the current media and plays it
	alterCurrentMedia(ffmpegAlterArgs) {
		if (!this.isEncoding) {
			try {
				let ffmpegArgs = ['-i', path.join(media_tmp_path, this.currentVideo.getMediaFilename())];
				const newModifiedMediaFilename = `modified${this.currentVideo.getModifiedMediaFilenames().length + 1}-` + this.currentVideo.getMediaFilename();
				ffmpegArgs = ffmpegArgs.concat(ffmpegAlterArgs, ['-y', path.join(media_tmp_path, newModifiedMediaFilename)]);
				this.currentVideo.addModifiedMediaFilename(newModifiedMediaFilename);
				const process = spawn('ffmpeg', ffmpegArgs);
				this.isEncoding = true;

				process.stdout.on('data', (data) => {
					console.log(data.toString());
				});

				// process.stderr.on('data', (data) => {
				// 	console.warn(data.toString());
				// });

				process.on('close', () => {
					// set isEncoding to false
					this.isEncoding = false;

					// set media filename
					this.currentVideo.setMediaFilename(newModifiedMediaFilename);

					// play
					this.resource = createAudioResource('./temp_media/' + newModifiedMediaFilename);
					this.player.play(this.resource);
				});
			}
			catch (error) {
				this.isEncoding = false;
				console.error(error);
				throw new Error('An error occured. The developer will look into this.');
			}
		}
		else {
			throw new Error('The player is currently processing a task requested by the user beforehand.');
		}
	}

	bassBoostCurrentSong(bassBoostAmount) {
		this.alterCurrentMedia(['-af', `bass=g=${bassBoostAmount}`]);
	}

	earrapeCurrentSong() {
		this.alterCurrentMedia(['-af', 'bass=g=20:f=500,acrusher=.4:1:64:0:log']);
	}

	// skips the current playing song
	skip() {
		if ((this.player.state.status === AudioPlayerStatus.Playing) || (this.player.state.status === AudioPlayerStatus.Buffering) || (this.queue.length > 0)) {
			this.player.stop();
			return true;
		}
		else {
			return false;
		}
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
			return message.channel.send('Removed Song #' + index + ' from the queue');
		}
		else {
			return message.channel.send('No such music in queue.');
		}
	}

	leave() {
		try {
			clearTimeout(this.inactivityTimeout);
			if (getVoiceConnection(this.channel.guild.id) != undefined) {
				this.connection.destroy();
				return true;
			}
			else {
				return false;
			}
		}
		catch (err) {
			console.warn('Destroying already destroyed voice connection.');
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