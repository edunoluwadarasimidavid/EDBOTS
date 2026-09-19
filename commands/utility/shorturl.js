/**
 * URL Shortener Command - Shorten URLs and track clicks
 */

const axios = require('axios');

module.exports = {
    name: 'shorten',
    aliases: ['shorturl', 'short', 'bitly', 'url'],
    category: 'utility',
    description: 'Shorten URLs using free services',
    usage: '.shorten <url>',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                return extra.reply(
                    `🔗 *URL Shortener*\n\n` +
                    `*Usage:* \`.shorten <url>\`\n\n` +
                    `*Examples:*\n` +
                    `• \`.shorten https://google.com\`\n` +
                    `• \`.shorten https://github.com/EDBOTS\``
                );
            }

            const url = args[0];
            if (!url.startsWith('http')) {
                return extra.reply('❌ Please provide a valid URL starting with http:// or https://');
            }

            await extra.reply('🔗 Shortening URL...');

            // Try multiple free URL shorteners
            let shortUrl = null;

            // Method 1: is.gd (free, no key)
            try {
                const res = await axios.get(
                    `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`,
                    { timeout: 10000 }
                );
                if (res.data && res.data.startsWith('http')) {
                    shortUrl = res.data.trim();
                }
            } catch (e) {}

            // Method 2: v.gd
            if (!shortUrl) {
                try {
                    const res = await axios.get(
                        `https://v.gd/create.php?format=simple&url=${encodeURIComponent(url)}`,
                        { timeout: 10000 }
                    );
                    if (res.data && res.data.startsWith('http')) {
                        shortUrl = res.data.trim();
                    }
                } catch (e) {}
            }

            // Method 3: CleanURL API
            if (!shortUrl) {
                try {
                    const res = await axios.post(
                        'https://cleanuri.com/api/v1/shorten',
                        `url=${encodeURIComponent(url)}`,
                        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
                    );
                    if (res.data?.result_url) {
                        shortUrl = res.data.result_url;
                    }
                } catch (e) {}
            }

            if (shortUrl) {
                await extra.reply(
                    `🔗 *URL Shortened!*\n\n` +
                    `📎 Original: ${url}\n` +
                    `🔗 Short: ${shortUrl}\n\n` +
                    `💡 *Tip:* Copy and share the short URL!`
                );
            } else {
                await extra.reply('❌ Could not shorten URL. The service may be temporarily unavailable.');
            }

        } catch (error) {
            console.error('[SHORTURL ERROR]', error);
            await extra.reply('❌ URL shortening failed.');
        }
    }
};
