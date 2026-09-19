/**
 * Quote Command - Get inspirational quotes
 */

const APIs = require('../../utils/api');

module.exports = {
    name: 'quote',
    aliases: ['inspire', 'motivation', 'wisdom'],
    category: 'fun',
    description: 'Get an inspirational quote',
    usage: '.quote',
    
    async execute(sock, msg, args, extra) {
        try {
            await extra.reply('⏳ Fetching inspiration...');

            const quote = await APIs.getQuote();

            const text = `✨ *Inspiration*\n\n` +
                `_"${quote.text}"_\n\n` +
                `— *${quote.author}*`;

            await extra.reply(text);

        } catch (error) {
            console.error('[QUOTE ERROR]', error);
            await extra.reply('❌ Could not fetch a quote. Try again later.');
        }
    }
};
