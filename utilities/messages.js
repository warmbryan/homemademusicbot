const client = require('../client');

function sendMessage(tcId, message) {
	client.channels.fetch(tcId)
		.then(textChannel => {
			textChannel.send(message);
		});
}

module.exports = {
	sendMessage,
};