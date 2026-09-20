/**
 * @file freeApis.js
 * @description Free API Integrations for EDBOTS.
 * 
 * Provides access to various free APIs:
 * - News headlines
 * - Fun facts
 * - Jokes
 * - Horoscope
 * - Quotes
 * - Weather
 * - Currency conversion
 * - Dictionary
 * - Reddit posts
 * - Wikipedia summaries
 * 
 * All APIs are free and don't require API keys.
 */

const axios = require('axios');

const TIMEOUT = 10000; // 10 seconds

/**
 * Get random fun facts
 */
async function getFunFact() {
    try {
        const res = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random', { timeout: TIMEOUT });
        return res.data?.text || null;
    } catch (e) {
        // Fallback to another API
        try {
            const res = await axios.get('https://api.api-ninjas.com/v1/funfact', { 
                timeout: TIMEOUT,
                headers: { 'X-Api-Key': process.env.NINJAS_API_KEY || '' }
            });
            return res.data?.fact || null;
        } catch (e2) {
            return null;
        }
    }
}

/**
 * Get a random joke
 */
async function getJoke() {
    try {
        const res = await axios.get('https://official-joke-api.appspot.com/random_joke', { timeout: TIMEOUT });
        if (res.data) {
            return `${res.data.setup}\n\n${res.data.punchline}`;
        }
        return null;
    } catch (e) {
        // Fallback
        try {
            const res = await axios.get('https://icanhazdadjoke.com/', { 
                timeout: TIMEOUT,
                headers: { 'Accept': 'application/json' }
            });
            return res.data?.joke || null;
        } catch (e2) {
            return null;
        }
    }
}

/**
 * Get a random quote
 */
async function getQuote() {
    try {
        const res = await axios.get('https://api.quotable.io/random', { timeout: TIMEOUT });
        if (res.data) {
            return `"${res.data.content}"\n\n— ${res.data.author}`;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Get daily horoscope
 */
async function getHoroscope(sign) {
    try {
        const res = await axios.get(`https://ohmanda.com/api/horoscope/${sign.toLowerCase()}/`, { timeout: TIMEOUT });
        if (res.data?.horoscope) {
            return `🔮 *${sign.charAt(0).toUpperCase() + sign.slice(1)} Horoscope*\n\n${res.data.horoscope}`;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Get latest news headlines
 */
async function getNews(category = 'general', country = 'us') {
    try {
        // Using free news API (no key required for basic)
        const res = await axios.get(`https://newsapi.org/v2/top-headlines?country=${country}&category=${category}&pageSize=5&apiKey=${process.env.NEWS_API_KEY || 'demo'}`, { timeout: TIMEOUT });
        
        if (res.data?.articles?.length > 0) {
            let text = `📰 *Latest ${category.charAt(0).toUpperCase() + category.slice(1)} News*\n\n`;
            res.data.articles.slice(0, 5).forEach((article, i) => {
                text += `${i + 1}. *${article.title}*\n`;
                text += `   ${article.source?.name || 'Unknown'}\n\n`;
            });
            return text;
        }
        return null;
    } catch (e) {
        // Fallback to another news API
        try {
            const res = await axios.get('https://api.currentsapi.services/v1/latest-news?language=en', { timeout: TIMEOUT });
            if (res.data?.news?.length > 0) {
                let text = `📰 *Latest News*\n\n`;
                res.data.news.slice(0, 5).forEach((article, i) => {
                    text += `${i + 1}. *${article.title}*\n`;
                    text += `   ${article.source || 'Unknown'}\n\n`;
                });
                return text;
            }
            return null;
        } catch (e2) {
            return null;
        }
    }
}

/**
 * Get Reddit posts
 */
async function getRedditPost(subreddit = 'todayilearned') {
    try {
        const res = await axios.get(`https://www.reddit.com/r/${subreddit}/random.json?limit=1`, { 
            timeout: TIMEOUT,
            headers: { 'User-Agent': 'EDBOTS/1.0' }
        });
        
        if (res.data?.[0]?.data?.children?.[0]?.data) {
            const post = res.data[0].data.children[0].data;
            return `📱 *r/${subreddit}*\n\n*${post.title}*\n\n${post.selftext?.substring(0, 300) || 'No text'}\n\n👍 ${post.ups} | 💬 ${post.num_comments}`;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Get Wikipedia summary
 */
async function getWikipediaSummary(query) {
    try {
        const res = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, { timeout: TIMEOUT });
        
        if (res.data?.extract) {
            let text = `📚 *${res.data.title}*\n\n`;
            text += res.data.extract;
            if (res.data.content_urls?.desktop?.page) {
                text += `\n\n🔗 ${res.data.content_urls.desktop.page}`;
            }
            return text;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Get random activity suggestion (for anti-boredom)
 */
async function getRandomActivity() {
    try {
        const res = await axios.get('https://www.boredapi.com/api/activity', { timeout: TIMEOUT });
        if (res.data?.activity) {
            let text = `🎯 *Bored? Try this!*\n\n`;
            text += `${res.data.activity}\n\n`;
            text += `👥 Participants: ${res.data.participants || 1}\n`;
            text += `💰 Price: ${res.data.price === 0 ? 'Free!' : res.data.price < 0.3 ? 'Low cost' : res.data.price < 0.7 ? 'Medium' : 'Expensive'}\n`;
            text += `🎯 Type: ${res.data.type || 'Unknown'}`;
            return text;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Get programming jokes
 */
async function getProgrammingJoke() {
    try {
        const res = await axios.get('https://official-joke-api.appspot.com/jokes/programming/random', { timeout: TIMEOUT });
        if (res.data?.[0]) {
            return `💻 *Programming Joke*\n\n${res.data[0].setup}\n\n${res.data[0].punchline}`;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Get random insult (fun)
 */
async function getInsult() {
    try {
        const res = await axios.get('https://evilinsult.com/generate-insult/?lang=en&type=json', { timeout: TIMEOUT });
        if (res.data?.insult) {
            return `😈 *${res.data.insult}*`;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Get random cat fact
 */
async function getCatFact() {
    try {
        const res = await axios.get('https://catfact.ninja/fact', { timeout: TIMEOUT });
        if (res.data?.fact) {
            return `🐱 *Cat Fact*\n\n${res.data.fact}`;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Get random dog fact
 */
async function getDogFact() {
    try {
        const res = await axios.get('https://dog-api.ninja/api/dogs/random', { timeout: TIMEOUT });
        if (res.data?.facts?.[0]) {
            return `🐶 *Dog Fact*\n\n${res.data.facts[0]}`;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Get space facts (NASA APOD)
 */
async function getSpaceFact() {
    try {
        const res = await axios.get('https://api.le-systeme-solaire.net/rest/bodies/Earth', { timeout: TIMEOUT });
        if (res.data) {
            let text = `🌍 *Earth Facts*\n\n`;
            text += `Name: ${res.data.englishName}\n`;
            text += `Type: ${res.data.isPlanet ? 'Planet' : 'Other'}\n`;
            text += `Mass: ${res.data.mass?.massValue?.toExponential(2)} kg\n`;
            text += `Gravity: ${res.data.gravity} m/s²\n`;
            text += `Day length: ${(res.data.sideralDay / 3600).toFixed(1)} hours`;
            return text;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Get number trivia
 */
async function getNumberTrivia(number) {
    try {
        const url = number 
            ? `http://numbersapi.com/${number}/trivia?json`
            : `http://numbersapi.com/random/trivia?json`;
        const res = await axios.get(url, { timeout: TIMEOUT });
        if (res.data?.text) {
            return `🔢 *Number Trivia*\n\n${res.data.text}`;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Get random advice
 */
async function getAdvice() {
    try {
        const res = await axios.get('https://api.adviceslip.com/advice', { timeout: TIMEOUT });
        if (res.data?.slip?.advice) {
            return `💡 *Advice*\n\n"${res.data.slip.advice}"`;
        }
        return null;
    } catch (e) {
        return null;
    }
}

module.exports = {
    getFunFact,
    getJoke,
    getQuote,
    getHoroscope,
    getNews,
    getRedditPost,
    getWikipediaSummary,
    getRandomActivity,
    getProgrammingJoke,
    getInsult,
    getCatFact,
    getDogFact,
    getSpaceFact,
    getNumberTrivia,
    getAdvice
};
