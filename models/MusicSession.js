const { AudioPlayerStatus, createAudioPlayer, createAudioResource, joinVoiceChannel, entersState, VoiceConnectionStatus, AudioPlayer } = require('@discordjs/voice');
const ytdl = require('ytdl-core-discord');
const prism = require('prism-media');
const { pipeline } = require('stream');

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
			// TODO: prevent skip from activating this feature
			if (newState.status === AudioPlayerStatus.Idle && oldState.status === AudioPlayerStatus.Playing) {
				if (this.queue.length > 0) {
					this.playMusic(this.getNextMusic());
				}
				else {
					this.currentVideo = undefined;
					this.currentStream = undefined;
					this.inactivityTimeout = setTimeout(() => {
						this.queueHistory('I will make my leave here, type `-join` or play something to start a new session. Maximum 5 minutes idle time.')
						this.connection.destroy();
					}, (5 * 60 * 1000));
				}
			}
		});

		this.connect()
			.then(connection => {
				connection.subscribe(this.player);
			})
			// TODO: log into db or something
			.catch(console.warn);
	}

	play(video) {
		clearTimeout(this.inactivityTimeout);
		if (this.player.state.status === AudioPlayerStatus.Idle && this.currentVideo === undefined) {
			this.playMusic(video);
		}
		else {
			this.queue.push(video);
		}
	}

	getNextMusic() {
		const music = this.queue.shift();
		this.queueHistory.push(music);
		return music;
	}

	async playMusic(video) {
		// TODO: refactor
		this.currentVideo = video;
		this.currentVideo.getMessage().channel.send('Playing `' + this.currentVideo.getTitle() + '`.');
		this.currentStream = await ytdl(video.getUrl(), ytdlOptions);
		this.resource = createAudioResource(this.currentStream);
		this.player.play(this.resource);
	}

	async seek(seekTime) {
		const videoInfo = await ytdl.getInfo(this.currentVideo.getUrl(), ytdlOptions);

		// thanks https://github.com/amishshah/ytdl-core-discord/blob/2e0148255165c832e123579427abeeb20c54384c/index.js#L17
		let filter = format => format.audioBitrate;
		if (videoInfo.isLive) filter = format => format.audioBitrate && format.isHLS;
		videoInfo.formats = videoInfo.formats
			.filter(filter)
			.sort((a, b) => b.audioBitrate - a.audioBitrate);
		const finalFormat = videoInfo.formats.find(format => !format.bitrate) || videoInfo.formats[0];


		// PCM seeking
		const transcoder = await new prism.FFmpeg({
			args: [
				'-reconnect', '1',
				'-reconnect_streamed', '1',
				'-reconnect_delay_max', '5',
				'-i', finalFormat.url,
				'-analyzeduration', '0',
				'-loglevel', '0',
				'-f', 's16le',
				'-ar', '48000',
				'-ac', '2',
				'-ss', seekTime,
			],
			shell: false,
		});

		const opus = new prism.opus.Encoder({ frameSize: 960, channels: 2, rate: 48000 });

		const newStream2 = await pipeline([transcoder, opus], () => {
			// nothing to see here
			// console.log(err);
		});
		// const newStream = await ytdl(this.currentVideo.getUrl(), ytdlOptions);
		const newResource = createAudioResource(newStream2);
		this.player.play(newResource);
	}

	skip(message) {
		this.player.stop();
		if (this.queue.length > 0) {
			message.channel.send('Skipped current song.');
			this.playMusic(this.getNextMusic());
		}
		else {
			message.channel.send('Skipped current song. No music in queue, add some songs!');
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

	getQueue() {
		return this.queue;
	}

	getQueueHistory() {
		return this.queueHistory;
	}

	leave() {
		if (this.connection !== undefined) {
			this.connection.destroy();
		}
	}

	getPlayerStatus() {
		return this.player.state.status;
	}

	getPlayerDuration() {
		return this.resource.playbackDuration;
	}
}

module.exports = MusicSession;