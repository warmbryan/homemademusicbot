const removeFromQueueRe = /(^-r (?<songId>\d+)$)|(^-r (?<keyword>[\w\W]+)$)/;
const seekRe = /^-seek (?<seekTime>\d{2}:\d{2}:\d{2})$/;

module.exports = { removeFromQueueRe, seekRe }