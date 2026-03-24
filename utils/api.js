/**
 * @file api.js
 * @description Centralized API handler with local fallbacks and stable public APIs.
 */

const axios = require('axios');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs-extra');
const path = require('path');

/**
 * YouTube downloader using local @distube/ytdl-core.
 */
async function getYoutubeAudio(url) {
    try {
        const info = await ytdl.getInfo(url);
        const format = ytdl.chooseFormat(info.formats, { 
            quality: 'highestaudio',
            filter: 'audioonly' 
        });
        
        const response = await axios.get(format.url, { responseType: 'arraybuffer' });
        return {
            title: info.videoDetails.title,
            thumbnail: info.videoDetails.thumbnails[0].url,
            buffer: Buffer.from(response.data),
            mimetype: 'audio/mpeg'
        };
    } catch (error) {
        console.error('[API] Local YouTube download failed:', error.message);
        throw error;
    }
}

/**
 * TikTok Downloader using tikwm.com (Public API)
 */
async function getTikTokDownload(url) {
    try {
        const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
        if (res.data.code === 0) {
            return {
                videoUrl: `https://www.tikwm.com${res.data.data.play}`,
                title: res.data.data.title,
                author: res.data.data.author.nickname
            };
        }
        throw new Error('TikTok API error');
    } catch (e) {
        console.error('[API] TikTok failed:', e.message);
        throw e;
    }
}

/**
 * Instagram Downloader (Public API Fallback)
 */
async function getInstagramDownload(url) {
    try {
        // Simple fallback using a public tool or scraper if needed
        // For now, return a placeholder or use a known stable API
        throw new Error('Instagram downloader currently unavailable.');
    } catch (e) {
        throw e;
    }
}

/**
 * AI Chat implementation (Free API fallback).
 */
async function chatAI(text) {
    try {
        // Use a public free AI API like Brainly or similar if available
        // For now, use a simple echo or a known free endpoint
        const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(text)}&lc=en`);
        return res.data.success || "I'm still learning! How can I help you today?";
    } catch (e) {
        return "AI is taking a nap. Try again later!";
    }
}

/**
 * Joke implementation.
 */
async function getJoke() {
    try {
        const res = await axios.get('https://v2.jokeapi.dev/joke/Any?type=single');
        return res.data.joke || "Couldn't find a joke right now.";
    } catch (e) {
        return "Joke API error.";
    }
}

/**
 * Meme implementation.
 */
async function getMeme() {
    try {
        const res = await axios.get('https://meme-api.com/gimme');
        return {
            url: res.data.url,
            title: res.data.title
        };
    } catch (e) {
        throw new Error("Meme API error.");
    }
}

/**
 * Screenshot API.
 */
async function screenshotWebsite(url) {
    // Using a public screenshot API
    return `https://api.screenshotmachine.com/?key=free&url=${encodeURIComponent(url)}&dimension=1024x768`;
}

module.exports = {
    getYoutubeAudio,
    getTikTokDownload,
    getInstagramDownload,
    chatAI,
    getJoke,
    getMeme,
    screenshotWebsite,
    // Legacy support
    getEliteProTechDownloadByUrl: (url) => null,
    getYupraDownloadByUrl: (url) => null,
    getEliteProTechVideoByUrl: (url) => null
};
