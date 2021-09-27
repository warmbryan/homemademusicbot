function getHelp(message) {
	return message.channel.send(`\`\`\`
Music
-clear   | clears the queue and stops the current audio
-leave   | makes the bot leave existing connected voice channel
-now     | shows the title of the current audio playing
-pause   | pauses the current audio
-play    | play an audio or add it to the queue
-queue   | shows the queue
-remove  | removes an audio in the queue
-seek    | seeks to a specific time in the audio
-skip    | skip to the next available audio in the queue
-status  | shows the status of the audio player
-unpause | un-pauses the current audio

Other commands
-help    | shows this message
	\`\`\``);
}

module.exports = getHelp;