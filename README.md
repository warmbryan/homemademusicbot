# Simple Discord Bot

## Setup
1. Download NodeJS
2. Clone the git repository
3. Create and fill up the config.json file in the project directory
4. Install node packages using `npm install` or `yarn install`
5. Run the bot using `node app.js`

## config.json sample
This file needs to be created manually by you. Fill in the following according to your requirements.
```
{
    "discord_token": "",
    "command_prefix": "!",
    "youtube_api_key": "",
    "media_tmp_path": "tmp_media",
    "ytdlp_launch_command": "./binaries/yt-dlp"
}
```