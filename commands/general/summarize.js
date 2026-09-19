/**
 * Summarize Command - AI-powered text summarization
 * Summarize articles, conversations, or any text
 */

const { askAI } = require('../../utils/aiEngine');
const { aiChat } = require('../../utils/aiProviders');

module.exports = {
    name: 'summarize',
    aliases: ['summary', 'tldr', 'brief'],
    category: 'ai',
    description: 'Summarize text using AI',
    usage: '.summarize <text> or reply to a long message',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            let text = '';

            // Check for quoted message
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted) {
                text = quoted.conversation ||
                    quoted.extendedTextMessage?.text ||
                    quoted.imageMessage?.caption ||
                    quoted.videoMessage?.caption || '';
            } else if (args.length > 0) {
                text = args.join(' ');
            }

            if (!text || text.length < 20) {
                return extra.reply(
                    `📝 *AI Summarizer*\n\n` +
                    `*Usage:*\n` +
                    `• \`.summarize <long text>\` - Summarize text\n` +
                    `• Reply to a message with \`.summarize\`\n\n` +
                    `*I can summarize:*\n` +
                    `• Articles and news\n` +
                    `• Long conversations\n` +
                    `• Research papers\n` +
                    `• Any text you paste`
                );
            }

            await extra.reply('📝 Analyzing and summarizing...');

            const prompt = `Summarize the following text in 2-3 concise bullet points. Be clear and informative:\n\n${text.slice(0, 3000)}`;
            const result = await aiChat(prompt, 'personal');

            if (result && result.length > 10) {
                await extra.reply(
                    `📝 *Summary*\n\n${result}\n\n` +
                    `📊 Original: ${text.length} characters → Summary: ${result.length} characters`
                );
            } else {
                await extra.reply('❌ Could not generate summary. Text may be too short.');
            }

        } catch (error) {
            console.error('[SUMMARIZE ERROR]', error);
            await extra.reply('❌ Summarization failed.');
        }
    }
};
