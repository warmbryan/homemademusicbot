const axios = require('axios').default;

const { ytkey } = require('../config.json');

const playlistUrlRe = /^-(p|play) https:\/\/www\.youtube\.com\/playlist\?list=(?<playlistId>[-_A-Za-z0-9]+)$/;
const videoUrlRe = /^-(p|play) (?<videoUrl>https:\/\/www.youtube.com\/watch\?v=(?<videoId>[-_A-Za-z0-9]{11}))$/;

const comboRe = /(^-(p|play) (?<playlistUrl>https:\/\/www\.youtube\.com\/playlist\?list=(?<playlistId>[-_A-Za-z0-9]+))$)|(^-(p|play) (?<videoUrl>https:\/\/www.youtube.com\/watch\?v=(?<videoId>[-_A-Za-z0-9]{11}))$)|(^-(p|play) (?<keyword>[\w \W]{3,40})$)/

function getPlaylistVideos(playlistId) {
    return axios.get(
        'https://youtube.googleapis.com/youtube/v3/playlistItems',
        {
            params: {
                part: 'id,contentDetails,snippet,status',
                key: ytkey,
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
                key: ytkey,
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
                key: ytkey,
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

module.exports = {
    getQuerySearchReults,
    getVideoInfo,
    getPlaylistVideos,
    craftVideoUrl,
    comboRe,
}