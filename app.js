// import required classes and objects
const { token, prefix } = require('./config.json');

// helpers
const { comboRe, getPlaylistVideos, getVideoInfo, getQuerySearchReults } = require('./helpers/YoutubeAPI');
const { removeFromQueueRe, seekRe } = require('./helpers/CommandsRE');

// models
const Video = require('./models/Video');

const { Client, Intents } = require('discord.js');
const MusicSession = require('./models/MusicSession');
const { getVoiceConnection, AudioPlayerStatus } = require('@discordjs/voice');

const musicSessions = new Object();
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });

client.once('ready', () => {
	console.log('Ready!');
	// TODO: add resume from crash, get active streams from db and join back to the voice channel at will reconnect and continue left over songs
	// when i start implementing stateful sessions using mysql
});

client.on('messageCreate', message => {
	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;

	// ACTION JOIN
	if (message.content.startsWith(`${prefix}join`)) {
		const channel = message.member?.voice.channel;
		if (!channel) return message.content.send('I don\'t see you in a voice channel!');
		musicSessions[message.guild.id] = new MusicSession(channel);
	}
	// ACTION LEAVE
	else if (message.content.startsWith(`${prefix}leave`)) {
		// TODO: fix logic of leaving
		musicSessions[message.guild.id].leave();
		return message.channel.send('See you later!');
	}
	// ACTION SKIP
	else if (message.content.startsWith(`${prefix}skip`)) {
		if (message.guild.id in musicSessions) {
			musicSessions[message.guild.id].skip(message);
		}
	}
	// ACTION PAUSE
	else if (message.content.startsWith(`${prefix}pause`)) {
		checkSession(message, false, session => {
			session.pause();
			message.channel.send('Player paused, use `-unpause` to unpause the player.');
		});
	}
	// ACTION UNPAUSE
	else if (message.content.startsWith(`${prefix}unpause`)) {
		checkSession(message, false, session => {
			session.unpause();
			message.channel.send('Music unpaused');
		});
	}
	// ACTION PLAY
	else if (message.content.startsWith(`${prefix}play`) || message.content.startsWith(`${prefix}p`)) {
		// join channel if not joinned yet
		const youtubeUrlMatch = message.content.match(comboRe);
		if (youtubeUrlMatch) {
			const vc = getVoiceConnection(message.guild.id);
			if (!vc) {
				musicSessions[message.guild.id] = new MusicSession(message.member?.voice.channel);
			}

			const session = musicSessions[message.guild.id];

			if (youtubeUrlMatch.groups?.videoUrl !== undefined) {
				// add new songs to queue
				getVideoInfo(youtubeUrlMatch.groups?.videoId)
					.then(response => {
						if (response.status === 200 && response.data?.items.length > 0) {
							response.data?.items.map(function(video) {
								session.play(new Video(video.id, video.snippet.title));
								if (session.getPlayerStatus() === (AudioPlayerStatus.Playing || AudioPlayerStatus.Buffering)) {
									message.channel.send(`Added \`${video.snippet.title}\` to the queue.`);
								}
								else {
									message.channel.send(`Playing \`${video.snippet.title}\`.`);
								}
							});
						}
					})
					.catch(console.warn);
			}
			else if (youtubeUrlMatch.groups?.playlistUrl !== undefined) {
				getPlaylistVideos(youtubeUrlMatch.groups?.playlistId)
					.then(response => {
						if (response.status === 200 && response.data?.items.length > 0) {
							response.data?.items.map(video => {
								session.play(new Video(video.contentDetails.videoId, video.snippet.title));
							});

							if (session.getPlayerStatus() === (AudioPlayerStatus.Playing || AudioPlayerStatus.Buffering)) {
								message.channel.send(`Added \`${response.data?.items.length}\` videos to queue.`);
							}
							else {
								message.channel.send(`Playing \`${response.data?.items[0].snippet.title}\` and added \`${response.data?.items.length - 1}\` videos to queue`);
							}
						}
					})
					.catch(console.warn);
			}
			// Keyword query
			else if (youtubeUrlMatch.groups?.keyword !== undefined) {
				getQuerySearchReults(youtubeUrlMatch.groups?.keyword, 5)
					.then(response => {
						if (response.status === 200 && response.data?.items.length > 0) {
							// grab first video
							const video = response.data?.items[0];
							session.play(new Video(video.id.videoId, video.snippet.title));

							if (session.getPlayerStatus() === (AudioPlayerStatus.Playing || AudioPlayerStatus.Buffering)) {
								message.channel.send(`Added \`${video.snippet.title}\` to the queue.`);
							}
							else {
								message.channel.send(`Playing \`${video.snippet.title}\`.`);
							}
						}
					})
					.catch(console.warn);
			}
		}
		else {
			return message.channel.send('Don\'t play nothing. :smile:');
		}
	}
	// ACTION STATUS
	else if (message.content.startsWith(`${prefix}status`)) {
		checkSession(message, false, session => {
			message.channel.send(`Status: ${session.getPlayerStatus()}, Duration: ${session.getPlayerDuration()}ms`);
		});
	}
	// ACTION QUEUE
	else if (message.content.startsWith(`${prefix}queue`)) {
		checkSession(message, false, session => {
			const queue = session.getQueue();
			let msg = '';

			if (queue.length > 0) {
				msg = 'A list of music\n```';
				queue.map((value, index) => {
					msg += `${index + 1}. ${value.getTitle()}\n`;
				});
				msg += '```';
			}
			else {
				msg = 'No music in queue, add some!';
			}

			message.channel.send(msg);
		});
	}
	// ACTION REMOVE
	else if (message.content.startsWith(`${prefix}remove`) || message.content.startsWith(`${prefix}r`)) {
		checkSession(message, false, session => {
			const reMatch = message.content.match(removeFromQueueRe);
			if (reMatch) {
				if (reMatch.groups?.songId !== undefined) {
					const songId = Number(reMatch.groups?.songId);
					session.remove(songId, message);
				}
				// TODO: remove song in queue using keyword
				// else if (reMatch.groups?.keyword !== undefined) {
				// 	const keyword = reMatch.groups?.keyword;
				// 	queue.map((videoId, index) => {
				// 	})
				// }
			}
			else {
				return message.channel.send('Try -r|-remove {songId}|{keyword} with songs in the queue.');
			}
		});
	}
	else if (message.content.startsWith(`${prefix}help`) || message.content.startsWith(`${prefix}H`)) {
		// TODO: list the commands
		return message.channel.send('This command is still W.I.P.');
	}
	else if (message.content.startsWith(`${prefix}seek`)) {
		// TODO: seek the music
		checkSession(message, false, session => {
			const seekValueMatch = message.content.match(seekRe);
			session.seek(seekValueMatch.groups?.seekTime);
		});
	}
});

client.login(token);

async function manageSession(message, autoCreateNewSession) {
	if (message.guild.id in musicSessions) {
		return musicSessions[message.guild.id];
	}
	else if (autoCreateNewSession) {
		musicSessions[message.guild.id] = new MusicSession(message.member?.voice.channel);
		return musicSessions[message.guild.id];
	}
	return undefined;
}

function checkSession(message, autoCreateNewSession, callback) {
	manageSession(message, false)
		.then(session => {
			if (session !== undefined) {
				callback(session);
			}
			else {
				message.channel.send('This guild does not have an active session. Use `-join` or play a music with `-p`|`-play` to start.');
			}
		})
		.catch(console.warn);
}