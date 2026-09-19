/**
 * Fortune Cookie Command
 * Get a random fortune
 */

const APIs = require('../../utils/api');

module.exports = {
    name: 'fortune',
    aliases: ['fortune', 'cookie', '8ball'],
    category: 'fun',
    description: 'Get your fortune cookie prediction',
    usage: '.fortune',
    
    async execute(sock, msg, args, extra) {
        try {
            const fortune = APIs.getFortune();

            const text = `🥠 *Fortune Cookie*\n\n` +
                `${fortune}\n\n` +
                `_The fortune cookie has spoken! 🍪_`;

            await extra.reply(text);

        } catch (error) {
            console.error('[FORTUNE ERROR]', error);
            await extra.reply('❌ The fortune cookie is shy today. Try again later!');
        }
    }
};
