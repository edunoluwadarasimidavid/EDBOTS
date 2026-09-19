/**
 * Anti-Spam Command - Enhanced group spam protection
 * Detects and warns/kicks spammers automatically
 */

const fs = require('fs');
const path = require('path');
const { getGroupSettings, updateGroupSettings } = require('../../database');

const SPAM_FILE = path.join(__dirname, '../../data/spamTracker.json');

function loadSpamTracker() {
    try {
        if (!fs.existsSync(SPAM_FILE)) {
            fs.writeFileSync(SPAM_FILE, JSON.stringify({}));
            return {};
        }
        return JSON.parse(fs.readFileSync(SPAM_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveSpamTracker(data) {
    try {
        const dir = path.dirname(SPAM_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SPAM_FILE, JSON.stringify(data, null, 2));
    } catch (e) {}
}

module.exports = {
    name: 'spamfilter',
    aliases: ['spam', 'spamprotect', 'antispam'],
    category: 'admin',
    description: 'Configure anti-spam protection for groups',
    usage: '.antispam <on/off/status/config>',
    isAdmin: true,
    isGroup: true,

    async execute(sock, msg, args, extra) {
        try {
            const groupId = extra.from;
            const settings = getGroupSettings(groupId);

            if (args.length === 0 || args[0] === 'status') {                    return extra.reply(
                    `🛡️ *Anti-Spam Protection*\n\n` +
                    `Status: ${settings.antiSpam ? '✅ ON' : '❌ OFF'}\n\n` +
                    `*Configuration:*\n` +
                    `• Max messages/minute: ${settings.spamLimit || 10}\n` +
                    `• Warn after: ${settings.spamWarn || 3} spam detections\n` +
                    `• Action: ${settings.spamAction || 'warn'}\n\n` +
                    `*Usage:*\n` +
                    `• \`.spamfilter on\` - Enable protection\n` +
                    `• \`.spamfilter off\` - Disable protection\n` +
                    `• \`.spamfilter config <limit> <warn> <action>\` - Configure\n` +
                    `  Actions: warn, kick, mute`
                );
            }

            const action = args[0].toLowerCase();

            if (action === 'on') {
                updateGroupSettings(groupId, { antiSpam: true });
                return extra.reply('✅ Anti-spam protection *ENABLED* for this group.');
            }

            if (action === 'off') {
                updateGroupSettings(groupId, { antiSpam: false });
                return extra.reply('❌ Anti-spam protection *DISABLED* for this group.');
            }

            if (action === 'config') {
                const limit = parseInt(args[1]) || 10;
                const warn = parseInt(args[2]) || 3;
                const spamAction = args[3] || 'warn';

                if (!['warn', 'kick', 'mute'].includes(spamAction)) {
                    return extra.reply('❌ Action must be: warn, kick, or mute');
                }

                updateGroupSettings(groupId, {
                    antiSpam: true,
                    spamLimit: limit,
                    spamWarn: warn,
                    spamAction: spamAction
                });

                return extra.reply(
                    `✅ *Anti-Spam Config Updated!*\n\n` +
                    `• Max messages/minute: ${limit}\n` +
                    `• Warn threshold: ${warn}\n` +
                    `• Action: ${spamAction}`
                );
            }

            return extra.reply('❌ Use `on`, `off`, `status`, or `config`.');

        } catch (error) {
            console.error('[ANTISPAM ERROR]', error);
            await extra.reply('❌ Error configuring anti-spam.');
        }
    }
};
