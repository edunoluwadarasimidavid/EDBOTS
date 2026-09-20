/**
 * @file news.js
 * @description News and content discovery commands using free APIs.
 * 
 * Commands:
 *   .news [category] - Get latest news headlines
 *   .reddit [subreddit] - Get Reddit posts
 *   .wiki <query> - Wikipedia summary
 */

const { getNews, getRedditPost, getWikipediaSummary } = require('../../utils/freeApis');

const NEWS_CATEGORIES = ['general', 'business', 'technology', 'science', 'health', 'sports', 'entertainment'];

module.exports = {
    name: 'news',
    aliases: ['headlines', 'latest'],
    category: 'utility',
    description: 'Get latest news headlines',
    usage: '.news [category]',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            const subCommand = args[0]?.toLowerCase();

            // Reddit command
            if (subCommand === 'reddit' || subCommand === 'sub') {
                const subreddit = args[1] || 'todayilearned';
                await extra.reply(`📱 Loading r/${subreddit}...`);
                const post = await getRedditPost(subreddit);
                if (post) return extra.reply(post);
                return extra.reply(`❌ Could not fetch posts from r/${subreddit}.`);
            }

            // Wikipedia command
            if (subCommand === 'wiki' || subCommand === 'wikipedia') {
                const query = args.slice(1).join(' ');
                if (!query) {
                    return extra.reply(
                        `📚 *Wikipedia Search*\n\n` +
                        `*Usage:* \`.news wiki <query>\`\n` +
                        `*Example:* \`.news wiki quantum physics\``
                    );
                }
                await extra.reply(`📚 Searching Wikipedia for "${query}"...`);
                const summary = await getWikipediaSummary(query);
                if (summary) return extra.reply(summary);
                return extra.reply(`❌ Could not find Wikipedia article for "${query}".`);
            }

            // Default: News headlines
            const category = subCommand || 'general';
            if (!NEWS_CATEGORIES.includes(category)) {
                return extra.reply(
                    `📰 *News Headlines*\n\n` +
                    `*Categories:* ${NEWS_CATEGORIES.join(', ')}\n\n` +
                    `*Usage:* \`.news [category]\`\n` +
                    `*Example:* \`.news technology\`\n\n` +
                    `*Also:*\n` +
                    `• \`.news reddit [subreddit]\` - Reddit posts\n` +
                    `• \`.news wiki <query>\` - Wikipedia summary`
                );
            }

            await extra.reply(`📰 Loading ${category} news...`);
            const news = await getNews(category);
            if (news) return extra.reply(news);
            return extra.reply(`❌ Could not fetch ${category} news. Try again later.`);
        } catch (error) {
            console.error('[NEWS ERROR]', error);
            await extra.reply('❌ Error fetching news.');
        }
    }
};
