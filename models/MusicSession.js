const { AudioPlayerStatus, createAudioPlayer, createAudioResource, joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core-discord');
const prism = require('prism-media');
const { pipeline } = require('stream');

const ytdlOptions = {
	filter: 'audioonly',
	// format: 'bestaudio/best',
	// quality: 'highestaudio',
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
			if (newState.status === AudioPlayerStatus.Idle && oldState.status === AudioPlayerStatus.Playing) {
				if (this.queue.length > 0) {
					this.playMusic(this.getNextMusic());
				}
				else {
					this.inactivityTimeout = setTimeout(() => {
						this.connection.destroy();
					}, 5 * 60 * 1000);
				}
				// TODO: leave when no music for x minutes
				// else {
				// 	setTimeout(() => {
				// 		player.destroy();
				// 	}, 60 * 2 * 1000);
				// }
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
		if (this.player.state.status === AudioPlayerStatus.Idle) {
			this.playMusic(video);
		}
		else {
			this.queue.push(video);
		}
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

	getNextMusic() {
		const music = this.queue.shift();
		this.queueHistory.push(music);
		return music;
	}

	async playMusic(video) {
		this.player.stop();
		this.currentVideo = video;
		this.currentStream = await ytdl(video.getUrl(), ytdlOptions);
		this.resource = createAudioResource(this.currentStream);
		this.player.play(this.resource);
	}

	skip(message) {
		// TODO: goes to the next one.
		message.channel.send('Skipped current song.');

		this.player.stop();
		if (this.queue.length > 0) {
			this.playMusic(this.getNextMusic());
		}
		else {
			message.channel.send('No music in queue, add some songs!');
		}
	}

	pause() {
		// TODO: pause the player
		this.player.pause();
	}

	unpause() {
		// TODO: unpause the player
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
		// const connection = getVoiceConnection(message.guild.id);
		// if (connection) {
		// 	connection.destroy();
		// 	return message.channel.send('KEKBye');
		// }

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