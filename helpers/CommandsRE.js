const removeFromQueueRe = /(^(-r|-remove) (?<songId>\d+)$)/;
const seekRe = /^-seek (?<seekTime>\d{2}:\d{2}:\d{2})$/;

module.exports = { removeFromQueueRe, seekRe }