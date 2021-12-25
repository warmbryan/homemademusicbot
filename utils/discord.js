const client = require('../app');

function sendMessage(channelId, message) {
	const channel = client.channels.cache.get(channelId);
	channel.send(message);
}

module.exports = {
	sendMessage,
};