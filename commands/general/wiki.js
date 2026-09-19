/**
 * Wikipedia Search Command - Search and get summaries from Wikipedia
 */

const axios = require('axios');

module.exports = {
    name: 'wiki',
    aliases: ['wikipedia', 'encyclopedia'],
    category: 'utility',
    description: 'Search Wikipedia for any topic',
    usage: '.wiki <search term>',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                return extra.reply(
                    `📚 *Wikipedia Search*\n\n` +
                    `*Usage:* \`.wiki <search term>\`\n\n` +
                    `*Examples:*\n` +
                    `• \`.wiki artificial intelligence\`\n` +
                    `• \`.wiki quantum computing\`\n` +
                    `• \`.wiki Nikola Tesla\``
                );
            }

            const query = args.join(' ');
            await extra.reply(`📚 Searching Wikipedia for "${query}"...`);

            // Search Wikipedia API
            const searchRes = await axios.get(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
                { timeout: 10000 }
            );

            const page = searchRes.data;

            if (page.type === 'disambiguation') {
                // Try search API for disambiguation
                const searchApi = await axios.get(
                    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`,
                    { timeout: 10000 }
                );

                const results = searchApi.data?.query?.search || [];
                if (results.length > 0) {
                    let text = `📚 *Multiple results found:*\n\n`;
                    results.forEach((r, i) => {
                        text += `${i + 1}. *${r.title}*\n   ${r.snippet.replace(/<[^>]*>/g, '').slice(0, 100)}...\n\n`;
                    });
                    text += `Try \`.wiki <exact title>\` for a specific article.`;
                    return extra.reply(text);
                }
                return extra.reply(`❌ No exact match found for "${query}". Try a different search term.`);
            }

            if (page.title) {
                let text = `📚 *${page.title}*\n\n`;

                if (page.extract) {
                    // Truncate to reasonable length
                    const extract = page.extract.length > 800
                        ? page.extract.slice(0, 800) + '...'
                        : page.extract;
                    text += `${extract}\n\n`;
                }

                if (page.content_urls?.desktop?.page) {
                    text += `🔗 Read more: ${page.content_urls.desktop.page}`;
                }

                if (page.thumbnail?.source) {
                    await sock.sendMessage(extra.from, {
                        image: { url: page.thumbnail.source },
                        caption: text
                    }, { quoted: msg });
                } else {
                    await extra.reply(text);
                }
            } else {
                await extra.reply(`❌ No Wikipedia article found for "${query}".`);
            }

        } catch (error) {
            if (error.response?.status === 404) {
                // Try search API as fallback
                try {
                    const searchApi = await axios.get(
                        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(args.join(' '))}&format=json&srlimit=3`,
                        { timeout: 10000 }
                    );
                    const results = searchApi.data?.query?.search || [];
                    if (results.length > 0) {
                        let text = `📚 *Search Results:*\n\n`;
                        results.forEach((r, i) => {
                            text += `${i + 1}. *${r.title}*\n   ${r.snippet.replace(/<[^>]*>/g, '').slice(0, 120)}...\n\n`;
                        });
                        return extra.reply(text);
                    }
                } catch (e) {}
            }
            console.error('[WIKI ERROR]', error);
            await extra.reply('❌ Wikipedia search failed.');
        }
    }
};
