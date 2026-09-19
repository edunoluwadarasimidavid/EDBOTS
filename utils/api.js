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

/**
 * Inspirational Quote API
 */
async function getQuote() {
    try {
        const res = await axios.get('https://zenquotes.io/api/random');
        if (res.data && res.data[0]) {
            return {
                text: res.data[0].q,
                author: res.data[0].a
            };
        }
        // Fallback API
        const res2 = await axios.get('https://api.quotable.io/random');
        return {
            text: res2.data.content,
            author: res2.data.author
        };
    } catch (e) {
        // Local fallback quotes
        const quotes = [
            { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
            { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
            { text: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
            { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
            { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
            { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
            { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
            { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" }
        ];
        return quotes[Math.floor(Math.random() * quotes.length)];
    }
}

/**
 * Urban Dictionary API
 */
async function getUrbanDefinition(term) {
    try {
        const res = await axios.get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);
        if (res.data && res.data.list && res.data.list.length > 0) {
            const def = res.data.list[0];
            return {
                word: def.word,
                definition: def.definition.replace(/\[/g, '').replace(/\]/g, ''),
                example: (def.example || '').replace(/\[/g, '').replace(/\]/g, ''),
                thumbsUp: def.thumbs_up,
                thumbsDown: def.thumbs_down,
                author: def.author
            };
        }
        return null;
    } catch (e) {
        console.error('[API] Urban Dictionary failed:', e.message);
        return null;
    }
}

/**
 * Translation API using MyMemory (free, no key needed)
 */
async function translate(text, targetLang) {
    try {
        const res = await axios.get(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`
        );
        if (res.data && res.data.responseData) {
            return {
                translation: res.data.responseData.translatedText,
                from: res.data.responseData.match?.source || 'en',
                to: targetLang
            };
        }
        return null;
    } catch (e) {
        console.error('[API] Translation failed:', e.message);
        return null;
    }
}

/**
 * QR Code Generator - returns a public API URL for QR generation
 */
function getQRCodeUrl(text) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
}

/**
 * Would You Rather questions (built-in)
 */
function getWYR() {
    const questions = [
        ["Be able to read minds", "Be able to fly"],
        ["Live without music", "Live without movies"],
        ["Have unlimited money", "Have unlimited time"],
        ["Be famous", "Be wealthy"],
        ["Travel the world for free", "Have a lifetime of free food"],
        ["Know how you die", "Know when you die"],
        ["Be the funniest person in the room", "Be the smartest person in the room"],
        ["Have a photographic memory", "Have a genius IQ"],
        ["Live in a big city", "Live in a small countryside town"],
        ["Always be 10 minutes early", "Always be 20 minutes late"],
        ["Have super strength", "Have super speed"],
        ["Never use social media again", "Never watch a movie again"],
        ["Find your soulmate", "Find a million dollars"],
        ["Be able to teleport", "Be able to be invisible"],
        ["Speak every language", "Play every instrument"],
        ["Own a pet dinosaur", "Own a pet dragon"],
        ["Live without AC", "Live without heating"],
        ["Have free WiFi everywhere", "Have free coffee everywhere"],
        ["Always know when someone is lying", "Never be lied to again"],
        ["Be a night owl", "Be an early bird"]
    ];
    return questions[Math.floor(Math.random() * questions.length)];
}

/**
 * Emoji translator - maps common words to emojis
 */
function textToEmoji(text) {
    const emojiMap = {
        'love': '❤️', 'heart': '💖', 'happy': '😊', 'sad': '😢', 'angry': '😡',
        'fire': '🔥', 'cool': '😎', 'star': '⭐', 'sun': '☀️', 'moon': '🌙',
        'rain': '🌧️', 'snow': '❄️', 'thunder': '⛈️', 'wind': '💨',
        'food': '🍕', 'pizza': '🍕', 'burger': '🍔', 'coffee': '☕', 'beer': '🍺',
        'money': '💰', 'cash': '💵', 'gold': '🥇', 'diamond': '💎',
        'car': '🚗', 'plane': '✈️', 'train': '🚂', 'bike': '🚲',
        'cat': '🐱', 'dog': '🐶', 'bird': '🐦', 'fish': '🐟', 'lion': '🦁', 'tiger': '🐯',
        'tree': '🌳', 'flower': '🌸', 'rose': '🌹',
        'music': '🎵', 'song': '🎶', 'dance': '💃',
        'phone': '📱', 'computer': '💻', 'gaming': '🎮', 'code': '👨‍💻',
        'strong': '💪', 'peace': '✌️', 'victory': '🤝', 'clap': '👏',
        'laugh': '😂', 'cry': '😭', 'shock': '😱', 'thinking': '🤔',
        'rocket': '🚀', 'lightning': '⚡', 'rainbow': '🌈', 'cloud': '☁️',
        'king': '👑', 'queen': '👸', 'magic': '✨', 'wand': '🪄',
        'time': '⏰', 'clock': '🕐', 'calendar': '📅',
        'work': '💼', 'school': '📚', 'hospital': '🏥', 'house': '🏠',
        'world': '🌍', 'space': '🚀', 'alien': '👽', 'ghost': '👻', 'skull': '💀',
        'yes': '✅', 'no': '❌', 'ok': '👍', 'good': '👍', 'bad': '👎',
        'lol': '😂', 'omg': '😱', 'hi': '👋', 'hello': '👋', 'bye': '👋',
        '100': '💯', 'perfect': '💯', 'fire': '🔥', 'lit': '🔥', 'hot': '🔥'
    };
    
    return text.split(/\s+/).map(word => {
        const lower = word.toLowerCase().replace(/[^a-z0-9]/g, '');
        return emojiMap[lower] || word;
    }).join(' ');
}

/**
 * Fortune cookie messages (built-in)
 */
function getFortune() {
    const fortunes = [
        "🌟 A great opportunity will present itself to you soon.",
        "💰 Financial prosperity is heading your way.",
        "❤️ Love will find you in the most unexpected place.",
        "🎯 Your hard work will pay off in a big way.",
        "🌈 After rain comes sunshine. Better days are ahead.",
        "🚀 A new adventure is about to begin. Embrace it.",
        "🧠 Trust your intuition. It will guide you wisely.",
        "💪 You are stronger than you think. Keep going.",
        "🍀 Luck is on your side. Take that chance.",
        "🤝 A meaningful connection will change your life.",
        "📖 Knowledge is your superpower. Keep learning.",
        "🌟 Someone is thinking about you right now.",
        "🎵 Music will heal your soul today.",
        "🌸 A fresh start is closer than you think.",
        "💎 You will discover a hidden talent within yourself.",
        "🦋 Change is coming. Welcome it with open arms.",
        "🌍 Your kindness will return to you tenfold.",
        "⏰ The timing is perfect. Act now.",
        "🌱 Plant seeds of kindness. Harvest joy.",
        "⭐ You are destined for greatness. Believe it."
    ];
    return fortunes[Math.floor(Math.random() * fortunes.length)];
}

module.exports = {
    getYoutubeAudio,
    getTikTokDownload,
    getInstagramDownload,
    chatAI,
    getJoke,
    getMeme,
    screenshotWebsite,
    getQuote,
    getUrbanDefinition,
    translate,
    getQRCodeUrl,
    getWYR,
    textToEmoji,
    getFortune,
    // Legacy support
    getEliteProTechDownloadByUrl: (url) => null,
    getYupraDownloadByUrl: (url) => null,
    getEliteProTechVideoByUrl: (url) => null
};
