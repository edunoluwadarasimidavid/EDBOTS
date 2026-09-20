/**
 * @file biz.js
 * @description Quick Business Mode Toggle - The main business command.
 * Enables business mode with welcome messages, auto-reply, analytics, and more.
 * 
 * Usage:
 *   .biz on          - Enable business mode with default settings
 *   .biz off         - Disable business mode
 *   .biz status      - Show current business settings
 *   .biz welcome on/off - Toggle welcome messages for new contacts
 *   .biz welcome <message> - Set custom welcome message
 *   .biz hours <hours> - Set business hours (e.g., "9AM-6PM")
 *   .biz away <message> - Set away message for after-hours
 *   .biz quickreply on/off - Toggle AI quick replies
 *   .biz greeting <message> - Set greeting message
 *   .biz catalog on/off - Toggle product catalog
 *   .biz analytics on/off - Toggle message analytics
 */

const fs = require('fs');
const path = require('path');
const { askAI } = require('../../utils/aiEngine');

const BIZ_CONFIG_FILE = path.join(__dirname, '../../data/bizConfig.json');

function loadBizConfig() {
    try {
        const dir = path.dirname(BIZ_CONFIG_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(BIZ_CONFIG_FILE)) {
            const defaults = {};
            fs.writeFileSync(BIZ_CONFIG_FILE, JSON.stringify(defaults, null, 2));
            return defaults;
        }
        return JSON.parse(fs.readFileSync(BIZ_CONFIG_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveBizConfig(data) {
    try {
        const dir = path.dirname(BIZ_CONFIG_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(BIZ_CONFIG_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[BizConfig] Save error:', e);
    }
}

function getDefaultBizSettings() {
    return {
        enabled: false,
        welcomeEnabled: true,
        welcomeMessage: 'Hello! 👋 Welcome to our business. How can we help you today?',
        businessHours: '9AM - 6PM (Mon-Fri)',
        awayMessage: 'We are currently away. Our business hours are {hours}. We will respond as soon as possible!',
        greetingMessage: 'Hi there! Thanks for reaching out. How can I assist you today?',
        quickReplyEnabled: true,
        catalogEnabled: false,
        analyticsEnabled: true,
        analytics: {
            totalMessages: 0,
            totalContacts: 0,
            dailyMessages: {},
            topKeywords: {},
            responseTime: [],
            lastUpdated: null
        },
        autoGreeting: true,
        smartReplies: true,
        sentimentTracking: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

module.exports = {
    name: 'biz',
    aliases: ['business', 'businessmode', 'bmode'],
    category: 'business',
    description: 'Quick business mode toggle with full settings',
    usage: '.biz <on/off/status/welcome/hours/away/greeting/quickreply/catalog/analytics>',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            const chatId = extra.from;
            const config = loadBizConfig();

            if (!config[chatId]) {
                config[chatId] = getDefaultBizSettings();
            }

            // No args - show status
            if (!args || args.length === 0) {
                return this.showStatus(extra, config[chatId]);
            }

            const action = args[0].toLowerCase();

            switch (action) {
                case 'on':
                case 'enable':
                case 'start':
                    return this.enableBiz(extra, config, chatId);

                case 'off':
                case 'disable':
                case 'stop':
                    return this.disableBiz(extra, config, chatId);

                case 'status':
                case 'info':
                    return this.showStatus(extra, config[chatId]);

                case 'welcome':
                    return this.handleWelcome(extra, config, chatId, args.slice(1));

                case 'hours':
                case 'businesshours':
                    return this.handleHours(extra, config, chatId, args.slice(1));

                case 'away':
                    return this.handleAway(extra, config, chatId, args.slice(1));

                case 'greeting':
                case 'greet':
                    return this.handleGreeting(extra, config, chatId, args.slice(1));

                case 'quickreply':
                case 'qr':
                    return this.handleQuickReply(extra, config, chatId, args.slice(1));

                case 'catalog':
                    return this.handleCatalog(extra, config, chatId, args.slice(1));

                case 'analytics':
                case 'stats':
                    return this.handleAnalytics(extra, config, chatId, args.slice(1));

                case 'template':
                case 'templates':
                    return this.showTemplates(extra);

                case 'reset':
                    return this.resetConfig(extra, config, chatId);

                default:
                    return extra.reply(
                        `❌ Unknown option: *${action}*\n\n` +
                        `*Available Options:*\n` +
                        `• \`.biz on\` - Enable business mode\n` +
                        `• \`.biz off\` - Disable business mode\n` +
                        `• \`.biz status\` - View current settings\n` +
                        `• \`.biz welcome\` - Configure welcome messages\n` +
                        `• \`.biz hours\` - Set business hours\n` +
                        `• \`.biz away\` - Set away message\n` +
                        `• \`.biz greeting\` - Set greeting message\n` +
                        `• \`.biz quickreply\` - Toggle AI quick replies\n` +
                        `• \`.biz catalog\` - Toggle product catalog\n` +
                        `• \`.biz analytics\` - View message analytics\n` +
                        `• \`.biz template\` - View welcome templates\n` +
                        `• \`.biz reset\` - Reset to defaults`
                    );
            }
        } catch (error) {
            console.error('[BIZ ERROR]', error);
            await extra.reply('❌ Error in business mode command.');
        }
    },

    async enableBiz(extra, config, chatId) {
        config[chatId].enabled = true;
        config[chatId].updatedAt = new Date().toISOString();
        saveBizConfig(config);

        // Also set mode to business
        const modeManager = require('../../utils/modeManager');
        modeManager.setMode(chatId, 'business');

        await extra.reply(
            `✅ *Business Mode Enabled!* 💼\n\n` +
            `Your bot is now in business mode with the following features:\n\n` +
            `📱 *Active Features:*\n` +
            `• Welcome messages for new contacts\n` +
            `• AI-powered auto-replies\n` +
            `• Business hours & away messages\n` +
            `• Message analytics\n` +
            `• Smart sentiment tracking\n\n` +
            `*Quick Settings:*\n` +
            `• \`.biz welcome\` - Configure welcome\n` +
            `• \`.biz hours\` - Set business hours\n` +
            `• \`.biz greeting\` - Set greeting\n` +
            `• \`.biz status\` - View all settings\n\n` +
            `💡 *Tip:* The bot will now respond to messages using your business settings.`
        );
    },

    async disableBiz(extra, config, chatId) {
        config[chatId].enabled = false;
        config[chatId].updatedAt = new Date().toISOString();
        saveBizConfig(config);

        // Reset mode to personal
        const modeManager = require('../../utils/modeManager');
        modeManager.setMode(chatId, 'personal');

        await extra.reply(
            `✅ *Business Mode Disabled*\n\n` +
            `Your bot has been switched back to personal mode.\n` +
            `All business features have been turned off.\n\n` +
            `Type \`.biz on\` to re-enable business mode.`
        );
    },

    async showStatus(extra, bizConfig) {
        const status = bizConfig.enabled ? '✅ ON' : '❌ OFF';
        const modeManager = require('../../utils/modeManager');
        const currentMode = modeManager.getMode(extra.from);

        let text = `💼 *Business Mode Status*\n\n`;
        text += `━━━━━━━━━━━━━━━━━━━\n`;
        text += `*Status:* ${status}\n`;
        text += `*Mode:* ${currentMode.toUpperCase()}\n`;
        text += `━━━━━━━━━━━━━━━━━━━\n\n`;

        text += `*Configuration:*\n`;
        text += `📱 Welcome: ${bizConfig.welcomeEnabled ? '✅ ON' : '❌ OFF'}\n`;
        text += `💬 Quick Reply: ${bizConfig.quickReplyEnabled ? '✅ ON' : '❌ OFF'}\n`;
        text += `📦 Catalog: ${bizConfig.catalogEnabled ? '✅ ON' : '❌ OFF'}\n`;
        text += `📊 Analytics: ${bizConfig.analyticsEnabled ? '✅ ON' : '❌ OFF'}\n`;
        text += `⏰ Auto Greeting: ${bizConfig.autoGreeting ? '✅ ON' : '❌ OFF'}\n`;
        text += `🧠 Smart Replies: ${bizConfig.smartReplies ? '✅ ON' : '❌ OFF'}\n`;
        text += `😊 Sentiment: ${bizConfig.sentimentTracking ? '✅ ON' : '❌ OFF'}\n\n`;

        text += `*Messages:*\n`;
        text += `👋 Welcome: ${bizConfig.welcomeMessage?.substring(0, 50)}${bizConfig.welcomeMessage?.length > 50 ? '...' : ''}\n`;
        text += `🕐 Hours: ${bizConfig.businessHours}\n`;
        text += `😴 Away: ${bizConfig.awayMessage?.substring(0, 50)}${bizConfig.awayMessage?.length > 50 ? '...' : ''}\n`;
        text += `🤝 Greeting: ${bizConfig.greetingMessage?.substring(0, 50)}${bizConfig.greetingMessage?.length > 50 ? '...' : ''}\n\n`;

        if (bizConfig.analytics) {
            text += `*Analytics Summary:*\n`;
            text += `📨 Total Messages: ${bizConfig.analytics.totalMessages || 0}\n`;
            text += `👤 Total Contacts: ${bizConfig.analytics.totalContacts || 0}\n`;
        }

        text += `\n━━━━━━━━━━━━━━━━━━━\n`;
        text += `> _Use \`.biz <setting>\` to configure_`;

        return extra.reply(text);
    },

    async handleWelcome(extra, config, chatId, args) {
        if (!args || args.length === 0) {
            return extra.reply(
                `👋 *Welcome Message Settings*\n\n` +
                `*Options:*\n` +
                `• \`.biz welcome on\` - Enable welcome messages\n` +
                `• \`.biz welcome off\` - Disable welcome messages\n` +
                `• \`.biz welcome <message>\` - Set custom welcome\n\n` +
                `*Current:* ${config[chatId].welcomeEnabled ? '✅ ON' : '❌ OFF'}\n` +
                `*Message:* ${config[chatId].welcomeMessage}\n\n` +
                `*Variables:*\n` +
                `• {name} - Contact name\n` +
                `• {time} - Current time\n` +
                `• {date} - Current date\n` +
                `• {business} - Business name`
            );
        }

        const action = args[0].toLowerCase();

        if (action === 'on' || action === 'enable') {
            config[chatId].welcomeEnabled = true;
            config[chatId].updatedAt = new Date().toISOString();
            saveBizConfig(config);
            return extra.reply('✅ Welcome messages *enabled*!');
        }

        if (action === 'off' || action === 'disable') {
            config[chatId].welcomeEnabled = false;
            config[chatId].updatedAt = new Date().toISOString();
            saveBizConfig(config);
            return extra.reply('❌ Welcome messages *disabled*!');
        }

        // Set custom welcome message
        const customMessage = args.join(' ');
        config[chatId].welcomeMessage = customMessage;
        config[chatId].updatedAt = new Date().toISOString();
        saveBizConfig(config);

        return extra.reply(
            `✅ *Welcome message updated!*\n\n` +
            `*New message:*\n${customMessage}\n\n` +
            `*Preview:*\n` +
            this.formatWelcomeMessage(customMessage, {
                name: 'John',
                time: new Date().toLocaleTimeString(),
                date: new Date().toLocaleDateString(),
                business: 'Your Business'
            })
        );
    },

    async handleHours(extra, config, chatId, args) {
        if (!args || args.length === 0) {
            return extra.reply(
                `🕐 *Business Hours*\n\n` +
                `*Current:* ${config[chatId].businessHours}\n\n` +
                `*Usage:* \`.biz hours 9AM-6PM (Mon-Fri)\`\n` +
                `*Example:* \`.biz hours 8AM-8PM (Mon-Sat)\``
            );
        }

        const hours = args.join(' ');
        config[chatId].businessHours = hours;
        config[chatId].updatedAt = new Date().toISOString();
        saveBizConfig(config);

        return extra.reply(`✅ *Business hours updated!*\n\nNew hours: ${hours}`);
    },

    async handleAway(extra, config, chatId, args) {
        if (!args || args.length === 0) {
            return extra.reply(
                `😴 *Away Message Settings*\n\n` +
                `*Current:* ${config[chatId].awayMessage}\n\n` +
                `*Usage:* \`.biz away We're closed. Back tomorrow!\`\n` +
                `*Variables:* {hours} - Your business hours`
            );
        }

        const message = args.join(' ');
        config[chatId].awayMessage = message;
        config[chatId].updatedAt = new Date().toISOString();
        saveBizConfig(config);

        return extra.reply(`✅ *Away message updated!*\n\nNew message: ${message}`);
    },

    async handleGreeting(extra, config, chatId, args) {
        if (!args || args.length === 0) {
            return extra.reply(
                `🤝 *Greeting Message Settings*\n\n` +
                `*Current:* ${config[chatId].greetingMessage}\n\n` +
                `*Usage:* \`.biz greeting Hi! How can I help you today?\`\n` +
                `*Variables:* {name} - Contact name`
            );
        }

        const message = args.join(' ');
        config[chatId].greetingMessage = message;
        config[chatId].updatedAt = new Date().toISOString();
        saveBizConfig(config);

        return extra.reply(`✅ *Greeting message updated!*\n\nNew message: ${message}`);
    },

    async handleQuickReply(extra, config, chatId, args) {
        if (!args || args.length === 0) {
            return extra.reply(
                `💬 *Quick Reply Settings*\n\n` +
                `*Current:* ${config[chatId].quickReplyEnabled ? '✅ ON' : '❌ OFF'}\n\n` +
                `*Options:*\n` +
                `• \`.biz quickreply on\` - Enable AI quick replies\n` +
                `• \`.biz quickreply off\` - Disable AI quick replies\n\n` +
                `When enabled, the bot uses AI to generate smart responses to customer messages.`
            );
        }

        const action = args[0].toLowerCase();
        if (action === 'on' || action === 'enable') {
            config[chatId].quickReplyEnabled = true;
            saveBizConfig(config);
            return extra.reply('✅ AI Quick Replies *enabled*!');
        }
        if (action === 'off' || action === 'disable') {
            config[chatId].quickReplyEnabled = false;
            saveBizConfig(config);
            return extra.reply('❌ AI Quick Replies *disabled*!');
        }
    },

    async handleCatalog(extra, config, chatId, args) {
        if (!args || args.length === 0) {
            return extra.reply(
                `📦 *Catalog Settings*\n\n` +
                `*Current:* ${config[chatId].catalogEnabled ? '✅ ON' : '❌ OFF'}\n\n` +
                `*Options:*\n` +
                `• \`.biz catalog on\` - Enable product catalog\n` +
                `• \`.biz catalog off\` - Disable product catalog\n\n` +
                `Use \`.catalog add <name> <price> <description>\` to add products.`
            );
        }

        const action = args[0].toLowerCase();
        if (action === 'on' || action === 'enable') {
            config[chatId].catalogEnabled = true;
            saveBizConfig(config);
            return extra.reply('✅ Product Catalog *enabled*!');
        }
        if (action === 'off' || action === 'disable') {
            config[chatId].catalogEnabled = false;
            saveBizConfig(config);
            return extra.reply('❌ Product Catalog *disabled*!');
        }
    },

    async handleAnalytics(extra, config, chatId, args) {
        if (!config[chatId].analyticsEnabled) {
            return extra.reply('📊 Analytics is currently *disabled*.\n\nEnable with: `.biz analytics on`');
        }

        const analytics = config[chatId].analytics || {};
        const today = new Date().toISOString().split('T')[0];
        const dailyCount = analytics.dailyMessages?.[today] || 0;

        let text = `📊 *Business Analytics*\n\n`;
        text += `━━━━━━━━━━━━━━━━━━━\n`;
        text += `*Today's Stats:*\n`;
        text += `📨 Messages Today: ${dailyCount}\n`;
        text += `📊 Total Messages: ${analytics.totalMessages || 0}\n`;
        text += `👤 Total Contacts: ${analytics.totalContacts || 0}\n`;
        text += `⏰ Avg Response: ${analytics.responseTime?.length > 0 ? Math.round(analytics.responseTime.reduce((a, b) => a + b, 0) / analytics.responseTime.length) + 's' : 'N/A'}\n`;
        text += `━━━━━━━━━━━━━━━━━━━\n\n`;

        // Top keywords
        if (analytics.topKeywords && Object.keys(analytics.topKeywords).length > 0) {
            const sorted = Object.entries(analytics.topKeywords)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            
            text += `*Top Keywords:*\n`;
            sorted.forEach(([word, count], i) => {
                text += `${i + 1}. ${word} (${count}x)\n`;
            });
        }

        text += `\n━━━━━━━━━━━━━━━━━━━\n`;
        text += `> _Analytics tracks all incoming messages automatically_`;

        return extra.reply(text);
    },

    showTemplates(extra) {
        let text = `📋 *Welcome Message Templates*\n\n`;
        text += `*Professional:*\n`;
        text += `Hello! 👋 Welcome to {business}. How can we assist you today?\n\n`;
        text += `*Friendly:*\n`;
        text += `Hey {name}! 🌟 Welcome! We're excited to have you. How can we help?\n\n`;
        text += `*Formal:*\n`;
        text += `Dear {name}, welcome to {business}. Our team is ready to assist you.\n\n`;
        text += `*After Hours:*\n`;
        text += `Thanks for reaching out! Our hours are {hours}. We'll respond soon! ⏰\n\n`;
        text += `*VIP:*\n`;
        text += `Welcome, {name}! 🎉 As a valued customer, we prioritize your needs. How can we help?\n\n`;
        text += `━━━━━━━━━━━━━━━━━━━\n`;
        text += `> _Use variables: {name}, {time}, {date}, {business}, {hours}_`;

        return extra.reply(text);
    },

    async resetConfig(extra, config, chatId) {
        config[chatId] = getDefaultBizSettings();
        saveBizConfig(config);
        return extra.reply('✅ Business settings have been *reset to defaults*.');
    },

    formatWelcomeMessage(template, vars = {}) {
        let msg = template;
        Object.entries(vars).forEach(([key, value]) => {
            msg = msg.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        });
        return msg;
    }
};
