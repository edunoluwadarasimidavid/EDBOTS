/**
 * Auto-Responder Command - Business auto-reply system
 * Set up automatic responses for common business queries
 */

const fs = require('fs');
const path = require('path');

const AUTOREPLY_FILE = path.join(__dirname, '../../data/autoReplies.json');

function loadAutoReplies() {
    try {
        if (!fs.existsSync(AUTOREPLY_FILE)) {
            fs.writeFileSync(AUTOREPLY_FILE, JSON.stringify({}));
            return {};
        }
        return JSON.parse(fs.readFileSync(AUTOREPLY_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveAutoReplies(data) {
    try {
        const dir = path.dirname(AUTOREPLY_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(AUTOREPLY_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[AutoReply] Save error:', e);
    }
}

const BUSINESS_TEMPLATES = {
    greeting: 'Hello! 👋 Welcome to our business. How can we help you today?',
    hours: '🕐 Our business hours are:\nMon-Fri: 9AM - 6PM\nSaturday: 10AM - 4PM\nSunday: Closed\n\nWe will respond to your message during business hours.',
    pricing: '💰 For pricing information, please visit our website or send us a message with "price" and the product name. We\'ll get back to you shortly!',
    thanks: 'Thank you for your message! 🙏 We appreciate your business. A team member will get back to you soon.',
    goodbye: 'Thank you for choosing our service! 👋 We hope to serve you again. Have a great day!',
    unavailable: 'We are currently away from our desk. 📵 Your message has been received and we will respond within 24 hours.',
    support: '🔧 For support, please describe your issue in detail and we\'ll assist you. You can also type:\n• "status" - Check order status\n• "refund" - Request a refund\n• "human" - Speak to a human agent'
};

module.exports = {
    name: 'autoresponder',
    aliases: ['ar', 'autoreply', 'autoresponse'],
    category: 'business',
    description: 'Set up auto-reply templates for business',
    usage: '.autoresponder <action> [template] [message]',
    groupOnly: true,

    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                let text = `🤖 *Auto-Responder System*\n\n`;
                text += `*Actions:*\n`;
                text += `• \`.ar add <keyword> <response>\` - Add auto-reply\n`;
                text += `• \`.ar remove <keyword>\` - Remove auto-reply\n`;
                text += `• \`.ar list\` - View all auto-replies\n`;
                text += `• \`.ar templates\` - View business templates\n`;
                text += `• \`.ar use <template>\` - Use a template\n`;
                text += `• \`.ar on\` / \`.ar off\` - Toggle auto-responder\n\n`;
                text += `*Available Templates:* ${Object.keys(BUSINESS_TEMPLATES).join(', ')}`;
                return extra.reply(text);
            }

            const action = args[0].toLowerCase();
            const replies = loadAutoReplies();
            const chatId = extra.from;

            if (!replies[chatId]) replies[chatId] = { enabled: false, rules: {} };

            switch (action) {
                case 'on': {
                    replies[chatId].enabled = true;
                    saveAutoReplies(replies);
                    return extra.reply('✅ Auto-responder *ON* for this chat.');
                }
                case 'off': {
                    replies[chatId].enabled = false;
                    saveAutoReplies(replies);
                    return extra.reply('❌ Auto-responder *OFF* for this chat.');
                }
                case 'add': {
                    const keyword = args[1]?.toLowerCase();
                    const response = args.slice(2).join(' ');
                    if (!keyword || !response) {
                        return extra.reply('❌ Usage: `.ar add <keyword> <response>`');
                    }
                    replies[chatId].rules[keyword] = response;
                    saveAutoReplies(replies);
                    return extra.reply(`✅ Auto-reply added:\n*Keyword:* ${keyword}\n*Response:* ${response}`);
                }
                case 'remove':
                case 'rm':
                case 'del': {
                    const keyword = args[1]?.toLowerCase();
                    if (!keyword) return extra.reply('❌ Usage: `.ar remove <keyword>`');
                    if (replies[chatId].rules[keyword]) {
                        delete replies[chatId].rules[keyword];
                        saveAutoReplies(replies);
                        return extra.reply(`✅ Removed auto-reply for: *${keyword}*`);
                    }
                    return extra.reply(`❌ No auto-reply found for: *${keyword}*`);
                }
                case 'list': {
                    const rules = replies[chatId].rules;
                    const keys = Object.keys(rules);
                    if (keys.length === 0) return extra.reply('📭 No auto-replies set for this chat.');

                    let text = `📋 *Auto-Replies (${keys.length}):*\n\n`;
                    keys.forEach((k, i) => {
                        text += `${i + 1}. *${k}* → ${rules[k].slice(0, 50)}${rules[k].length > 50 ? '...' : ''}\n`;
                    });
                    text += `\nStatus: ${replies[chatId].enabled ? '✅ ON' : '❌ OFF'}`;
                    return extra.reply(text);
                }
                case 'templates': {
                    let text = `📋 *Business Templates:*\n\n`;
                    Object.entries(BUSINESS_TEMPLATES).forEach(([key, val]) => {
                        text += `*${key}:*\n${val.slice(0, 80)}...\n\n`;
                    });
                    text += `Use \`.ar use <template>\` to add one.`;
                    return extra.reply(text);
                }
                case 'use': {
                    const template = args[1]?.toLowerCase();
                    if (!template || !BUSINESS_TEMPLATES[template]) {
                        return extra.reply(`❌ Unknown template. Available: ${Object.keys(BUSINESS_TEMPLATES).join(', ')}`);
                    }
                    const keyword = template;
                    replies[chatId].rules[keyword] = BUSINESS_TEMPLATES[template];
                    replies[chatId].enabled = true;
                    saveAutoReplies(replies);
                    return extra.reply(`✅ Template "${template}" added and auto-responder enabled!`);
                }
                default:
                    return extra.reply('❌ Unknown action. Use `add`, `remove`, `list`, `templates`, `use`, `on`, or `off`.');
            }

        } catch (error) {
            console.error('[AUTORESPONDER ERROR]', error);
            await extra.reply('❌ Error managing auto-responder.');
        }
    }
};
