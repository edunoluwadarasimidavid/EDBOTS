/**
 * Emoji Translator Command
 * Convert text to emoji equivalents
 */

const APIs = require('../../utils/api');

module.exports = {
    name: 'emoji',
    aliases: ['emojify', 'emtranslate'],
    category: 'fun',
    description: 'Translate text into emojis',
    usage: '.emoji <text>',
    
    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                return extra.reply(
                    `😄 *Emoji Translator*\n\n` +
                    `Usage: .emoji <text>\n\n` +
                    `*Examples:*\n` +
                    `• \`.emoji I love coffee and pizza\`\n` +
                    `• \`.emoji fire rain thunder\`\n` +
                    `• \`.emoji happy sad angry\``
                );
            }

            const text = args.join(' ');
            const translated = APIs.textToEmoji(text);

            await extra.reply(
                `😄 *Emoji Translation*\n\n` +
                `📝 Original: ${text}\n` +
                `🎭 Emojis: ${translated}`
            );

        } catch (error) {
            console.error('[EMOJI ERROR]', error);
            await extra.reply('❌ Error translating to emojis.');
        }
    }
};
