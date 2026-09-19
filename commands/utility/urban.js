/**
 * Urban Dictionary Command
 * Look up slang terms and definitions
 */

const APIs = require('../../utils/api');

module.exports = {
    name: 'urban',
    aliases: ['urbandict', 'slang'],
    category: 'utility',
    description: 'Look up a word on Urban Dictionary',
    usage: '.urban <word or phrase>',
    
    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                return extra.reply(
                    `📖 *Urban Dictionary*\n\n` +
                    `Usage: .urban <word or phrase>\n\n` +
                    `Example: .urban yeet`
                );
            }

            const term = args.join(' ');
            await extra.reply(`🔍 Looking up "${term}"...`);

            const result = await APIs.getUrbanDefinition(term);

            if (!result) {
                return extra.reply(`❌ No definitions found for "${term}".`);
            }

            const text = `📖 *Urban Dictionary*\n\n` +
                `🔤 *Word:* ${result.word}\n\n` +
                `📝 *Definition:*\n${result.definition}\n\n` +
                (result.example ? `💬 *Example:*\n"${result.example}"\n\n` : '') +
                `👍 ${result.thumbsUp} | 👎 ${result.thumbsDown}\n` +
                `✍️ By: ${result.author}`;

            await extra.reply(text);

        } catch (error) {
            console.error('[URBAN ERROR]', error);
            await extra.reply('❌ Error looking up term.');
        }
    }
};
