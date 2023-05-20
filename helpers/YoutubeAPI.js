const axios = require('axios').default;
const { youtube_api_key, command_prefix } = require('../config.json');
const comboRe = "(^\\" + command_prefix + "(p|play) (?<playlistUrl>https:\\/\\/www\\.youtube\.com\/playlist\?list=(?<playlistId>[-_A-Za-z0-9]+))$)|(^\\" + command_prefix + "(p|play) (?<videoUrl>https:\/\/www.youtube.com\/watch\?v=(?<videoId>[-_A-Za-z0-9]{11}))$)|(^-(p|play) (?<keyword>[\w \W]{3,40})$)";

const comboRe2 = "(^\\" + command_prefix + "(p|play) (?<playlistUrl>https:\\/\\/www\\.youtube\\.com\\/playlist\\?list=(?<playlistId>[-_A-Za-z0-9]+))$)|(^\\" + command_prefix + "(p|play) (?<videoUrl>https:\\/\\/www.youtube.com\\/watch\\?v=(?<videoId>[-_A-Za-z0-9]{11}))$)|(^\\" + command_prefix + "(p|play) (?<keyword>[\\w \\W]{3,40})$)";

function getPlaylistVideos(playlistId) {
    return axios.get(
        'https://youtube.googleapis.com/youtube/v3/playlistItems',
        {
            params: {
                part: 'id,contentDetails,snippet,status',
                key: youtube_api_key,
                playlistId,
                maxResults: 50
            },
            responseType: 'json',
        }
    )
}

function getVideoInfo(videoId) {
    return axios.get(
        'https://youtube.googleapis.com/youtube/v3/videos',
        {
            params: {
                key: youtube_api_key,
                part: 'snippet,contentDetails,statistics',
                id: videoId
            },
            responseType: 'json',
        }
    )
}

function getQuerySearchReults(query, maxResults) {
    return axios.get(
        'https://www.googleapis.com/youtube/v3/search',
        {
            params: {
                key: youtube_api_key,
                part: 'snippet',
                q: query,
                maxResults
            },
            responseType: 'json',
        }
    )
}

function craftVideoUrl(videoId) {
    return 'https://www.youtube.com/watch?v=' + videoId;
}

function getVideoBlockedStatus(videoId, callback) {
    return axios.get(
        'https://youtube.googleapis.com/youtube/v3/videos',
        {
            params: {
                key: youtube_api_key,
                part: 'snippet,contentDetails,statistics',
                id: videoId
            },
            responseType: 'json',
        }
    )
        .then(response)
        .catch(err)
        .finally(console.log());
}

module.exports = {
    getQuerySearchReults,
    getVideoInfo,
    getPlaylistVideos,
    craftVideoUrl,
    getVideoBlockedStatus,
    comboRe,
    comboRe2,
}