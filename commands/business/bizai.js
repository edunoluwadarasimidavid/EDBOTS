/**
 * Business AI Command - AI-powered business tools
 * Generate social media posts, emails, ads, and business content
 */

const { aiGenerateBusinessContent, aiCustomerSupport, aiChat } = require('../../utils/aiProviders');

module.exports = {
    name: 'bizai',
    aliases: ['business-ai', 'biz', 'bota'],
    category: 'business',
    description: 'AI-powered business content generator',
    usage: '.bizai <type> <topic>',
    groupOnly: false,

    async execute(sock, msg, args, extra) {
        try {
            if (args.length < 2) {
                return extra.reply(
                    `💼 *Business AI Assistant*\n\n` +
                    `*Content Types:*\n` +
                    `• \`.bizai social <topic>\` - Social media post\n` +
                    `• \`.bizai email <topic>\` - Professional email\n` +
                    `• \`.bizai ad <topic>\` - Advertisement copy\n` +
                    `• \`.bizai bio <topic>\` - Business bio\n` +
                    `• \`.bizai support <query>\` - Customer support response\n` +
                    `• \`.bizai ask <question>\` - General business advice\n\n` +
                    `*Examples:*\n` +
                    `• \`.bizai social launching new product\`\n` +
                    `• \`.bizai email partnership proposal\`\n` +
                    `• \`.bizai ad summer sale 50% off\`\n` +
                    `• \`.bizai support order not received\``
                );
            }

            const type = args[0].toLowerCase();
            const topic = args.slice(1).join(' ');

            await extra.reply('⏳ Generating business content...');

            let result = null;

            switch (type) {
                case 'social':
                case 'post':
                    result = await aiGenerateBusinessContent('social', topic);
                    break;
                case 'email':
                    result = await aiGenerateBusinessContent('email', topic);
                    break;
                case 'ad':
                case 'advertisement':
                    result = await aiGenerateBusinessContent('ad', topic);
                    break;
                case 'bio':
                    result = await aiGenerateBusinessContent('bio', topic);
                    break;
                case 'support':
                case 'cs':
                    result = await aiCustomerSupport(topic);
                    break;
                case 'ask':
                case 'advice':
                    result = await aiChat(topic, 'business');
                    break;
                default:
                    return extra.reply('❌ Unknown type. Use `social`, `email`, `ad`, `bio`, `support`, or `ask`.');
            }

            if (!result) {
                return extra.reply('⚠️ AI service is currently unavailable. Please try again later.\n\n💡 *Tip:* Set up a free AI provider key in your environment variables:\n• `GROQ_API_KEY` (fastest, free at console.groq.com)\n• `SAMBANOVA_API_KEY` (free at cloud.sambanova.ai)\n• `OPENROUTER_API_KEY` (free at openrouter.ai)');
            }

            const typeEmojis = {
                'social': '📱', 'email': '📧', 'ad': '📢',
                'bio': '👤', 'support': '🔧', 'ask': '💡'
            };

            await extra.reply(
                `${typeEmojis[type] || '💼'} *${type.charAt(0).toUpperCase() + type.slice(1)} Content*\n\n` +
                `${result}`
            );

        } catch (error) {
            console.error('[BIZAI ERROR]', error);
            await extra.reply('❌ Error generating business content.');
        }
    }
};
