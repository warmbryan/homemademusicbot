#!/usr/bin/env node

// import required classes and objects
const { token, prefix } = require('./config.json');

// helpers
const { comboRe, getPlaylistVideos, getVideoInfo, getQuerySearchReults } = require('./helpers/YoutubeAPI');
const { removeFromQueueRe } = require('./helpers/CommandsRE');

// commands
const helpCommand = require('./commands/help');

// models
const Video = require('./models/Video');
const MusicSession = require('./models/MusicSession');

// imports
const { Client, Intents, MessageEmbed } = require('discord.js');
const { AudioPlayerStatus } = require('@discordjs/voice');

const musicSessions = new Object();
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });

String.prototype.unescapeHTML = function() {
	return String(this).replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&#39;', '\'').replace('&#x2F;', '/');
};

client.once('ready', () => {
	console.log('Ready!');

	// TODO: add resume from crash, get active streams from db and join back to the voice channel at will reconnect and continue left over songs
	// when i start implementing stateful sessions using mysql
});

client.on('messageCreate', message => {
	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;

	// ACTION JOIN
	if (message.content.startsWith(`${prefix}join `)) {
		checkSession(message, true, session => {
			session.join();
		});
	}
	// ACTION LEAVE
	else if (message.content.startsWith(`${prefix}leave `)) {
		checkSession(message, false, async session => {
			await session.leave();
			clearSession(message.guild.id);
			message.channel.send('See you later.');
		});
	}
	// ACTION SKIP
	else if (message.content.startsWith(`${prefix}skip `)) {
		checkSession(message, false, session => {
			session.skip();
			message.channel.send('Skipping current song.');
		});
	}
	// ACTION PAUSE
	else if (message.content.startsWith(`${prefix}pause `)) {
		checkSession(message, false, session => {
			session.pause();
			message.channel.send('Player paused, use `-unpause` to unpause the player.');
		});
	}
	// ACTION UNPAUSE
	else if (message.content.startsWith(`${prefix}unpause `)) {
		checkSession(message, false, session => {
			session.unpause();
			message.channel.send('Player unpaused');
		});
	}
	// ACTION PLAY
	else if (message.content.startsWith(`${prefix}play `) || message.content.startsWith(`${prefix}p `)) {
		const youtubeUrlMatch = message.content.match(comboRe);
		if (youtubeUrlMatch) {
			checkSession(message, true, session => {
				if (youtubeUrlMatch.groups?.videoUrl !== undefined) {
					// add new songs to queue
					getVideoInfo(youtubeUrlMatch.groups?.videoId)
						.then(response => {
							if (response.status === 200 && response.data?.items.length > 0) {
								response.data?.items.map(function(video) {
									session.play(new Video(video.id, unescape(video.snippet.title), message));
									if (session.getPlayerStatus() === (AudioPlayerStatus.Playing || AudioPlayerStatus.Buffering)) {
										message.channel.send(`Added \`${video.snippet.title.unescapeHTML()}\` to the queue.`);
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
									session.play(new Video(video.contentDetails.videoId, unescape(video.snippet.title), message));
								});

								if (session.getPlayerStatus() === (AudioPlayerStatus.Playing || AudioPlayerStatus.Buffering)) {
									message.channel.send(`Added \`${response.data?.items.length}\` videos to queue.`);
								}
								else {
									message.channel.send(`Added \`${response.data?.items.length - 1}\` videos to queue.`);
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
								session.play(new Video(video.id.videoId, unescape(video.snippet.title), message));

								if (session.getPlayerStatus() === (AudioPlayerStatus.Playing || AudioPlayerStatus.Buffering)) {
									message.channel.send(`Added \`${video.snippet.title.unescapeHTML()}\` to the queue.`);
								}
							}
							else {
								message.channel.send('No videos found with the keyword you have entered.');
							}
						})
						.catch(console.warn);
				}
			});
		}
		else {
			return message.channel.send('Don\'t play nothing. :smile:');
		}
	}
	else if (message.content.startsWith(`${prefix}status `)) {
		checkSession(message, false, session => {
			message.channel.send(`Status: ${session.getPlayerStatus()}, Duration: ${session.getPlayerDuration()}ms`);
		});
	}
	// ACTION QUEUE
	else if (message.content.startsWith(`${prefix}queue `)) {
		checkSession(message, false, session => {
			try {
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
					msg = 'No songs in queue, add some!';
				}

				message.channel.send(msg);
			}
			catch (error) {
				console.warn(error);
			}
		});
	}
	// ACTION REMOVE
	else if (message.content.startsWith(`${prefix}remove `) || message.content.startsWith(`${prefix}r `)) {
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
				return message.channel.send('Try `-r|-remove {songId}` with songs in the queue.');
			}
		});
	}
	else if (message.content.startsWith(`${prefix}help `) || message.content.startsWith(`${prefix}H `)) {
		helpCommand(message);
	}
	// TODO: rebuild seek command
	// else if (message.content.startsWith(`${prefix}seek`)) {
	// 	checkSession(message, false, session => {
	// 		const seekValueMatch = message.content.match(seekRe);
	// 		if (seekValueMatch && seekValueMatch.groups?.seekTime !== undefined) {
	// 			session.seek(seekValueMatch.groups?.seekTime);
	// 		}
	// 		else {
	// 			message.channel.send('Invalid seek format.');
	// 		}
	// 	});
	// }
	else if (message.content.startsWith(`${prefix}clear`)) {
		checkSession(message, false, session => {
			session.clear();
		});
	}
	else if (message.content.startsWith(`${prefix}now`)) {
		checkSession(message, false, session => {
			const cVideo = session.getCurrentVideo();

			const embedMsg = new MessageEmbed()
				.setTitle('Currently Playing')
				.setURL(cVideo.getUrl())
				.setDescription(cVideo.getTitle())
				.setTimestamp();

			message.channel.send({ embeds: [embedMsg] });
		});
	}
	else if (message.content.startsWith(`${prefix}getvideo`)) {
		checkSession(message, false, session => {
			session.getLastVideo();
		});
	}

	else if (message.content.startsWith(`${prefix}back`)) {
		checkSession(message, false, session => {
			session.back();
		});
	}
});

client.login(token);

async function manageSession(message, autoCreateNewSession) {
	if (message.guild.id in musicSessions) {
		return musicSessions[message.guild.id];
	}
	else if (autoCreateNewSession) {
		if (message.member?.voice.channel) {
			musicSessions[message.guild.id] = new MusicSession(message.member?.voice.channel);
			return musicSessions[message.guild.id];
		}
		else {
			message.channel.send('I do not see you in a voice channel, join one before you use me.');
			return false;
		}
	}
	return false;
}

function checkSession(message, autoCreateNewSession, callback) {
	manageSession(message, autoCreateNewSession)
		.then(session => {
			if (session) {
				callback(session);
			}
			else if (!autoCreateNewSession && !session) {
				message.channel.send('This guild does not have an active session. Use `-join` or play a music with `-p`|`-play` to start.');
			}
		})
		.catch(console.warn);
}

function clearSession(guildId) {
	if (guildId in musicSessions) {
		delete musicSessions[guildId];
	}
}