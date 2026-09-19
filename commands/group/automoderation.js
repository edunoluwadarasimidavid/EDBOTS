/**
 * Auto-Moderation Command - Automated group moderation
 * Word filters, link protection, auto-welcome, and auto-actions
 */

const fs = require('fs');
const path = require('path');
const { getGroupSettings, updateGroupSettings } = require('../../database');

const MOD_FILE = path.join(__dirname, '../../data/moderation.json');

function loadModData() {
    try {
        if (!fs.existsSync(MOD_FILE)) {
            fs.writeFileSync(MOD_FILE, JSON.stringify({}));
            return {};
        }
        return JSON.parse(fs.readFileSync(MOD_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveModData(data) {
    try {
        const dir = path.dirname(MOD_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(MOD_FILE, JSON.stringify(data, null, 2));
    } catch (e) {}
}

module.exports = {
    name: 'automod',
    aliases: ['automoderation', 'moderation', 'automod'],
    category: 'admin',
    description: 'Automated group moderation tools',
    usage: '.automod <action> [args]',
    isAdmin: true,
    isGroup: true,

    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                return extra.reply(
                    `🛡️ *Auto-Moderation System*\n\n` +
                    `*Actions:*\n` +
                    `• \`.automod banned <word>\` - Add banned word\n` +
                    `• \`.automod unban <word>\` - Remove banned word\n` +
                    `• \`.automod words\` - List banned words\n` +
                    `• \`.automod links <on/off>\` - Link protection\n` +
                    `• \`.automod caps <on/off> <percent>\` - Caps lock filter\n` +
                    `• \`.automod spam <on/off>\` - Spam protection\n` +
                    `• \`.automod status\` - View all settings\n\n` +
                    `*Auto-Actions:*\n` +
                    `• \`.automod warn-action <warn/kick/mute>\` - Set action`
                );
            }

            const groupId = extra.from;
            const modData = loadModData();
            if (!modData[groupId]) modData[groupId] = { bannedWords: [], settings: {} };

            const action = args[0].toLowerCase();

            switch (action) {
                case 'banned':
                case 'ban': {
                    const word = args.slice(1).join(' ').toLowerCase();
                    if (!word) return extra.reply('❌ Usage: `.automod banned <word>`');
                    if (!modData[groupId].bannedWords.includes(word)) {
                        modData[groupId].bannedWords.push(word);
                        saveModData(modData);
                        return extra.reply(`✅ Added banned word: *${word}*`);
                    }
                    return extra.reply(`⚠️ Word "${word}" is already banned.`);
                }

                case 'unban': {
                    const word = args.slice(1).join(' ').toLowerCase();
                    if (!word) return extra.reply('❌ Usage: `.automod unban <word>`');
                    const idx = modData[groupId].bannedWords.indexOf(word);
                    if (idx > -1) {
                        modData[groupId].bannedWords.splice(idx, 1);
                        saveModData(modData);
                        return extra.reply(`✅ Removed banned word: *${word}*`);
                    }
                    return extra.reply(`❌ Word "${word}" is not banned.`);
                }

                case 'words': {
                    const words = modData[groupId].bannedWords;
                    if (words.length === 0) return extra.reply('📭 No banned words.');
                    return extra.reply(`🚫 *Banned Words (${words.length}):*\n${words.map((w, i) => `${i + 1}. ${w}`).join('\n')}`);
                }

                case 'links': {
                    const toggle = args[1]?.toLowerCase();
                    if (toggle === 'on') {
                        modData[groupId].settings.linkProtection = true;
                        saveModData(modData);
                        return extra.reply('✅ Link protection *ON*');
                    } else if (toggle === 'off') {
                        modData[groupId].settings.linkProtection = false;
                        saveModData(modData);
                        return extra.reply('❌ Link protection *OFF*');
                    }
                    const enabled = modData[groupId].settings.linkProtection;
                    return extra.reply(`🔗 Link protection: ${enabled ? '✅ ON' : '❌ OFF'}\nUsage: \`.automod links on/off\``);
                }

                case 'caps': {
                    const toggle = args[1]?.toLowerCase();
                    const percent = parseInt(args[2]) || 70;
                    if (toggle === 'on') {
                        modData[groupId].settings.capsFilter = true;
                        modData[groupId].settings.capsPercent = percent;
                        saveModData(modData);
                        return extra.reply(`✅ Caps filter *ON* (threshold: ${percent}%)`);
                    } else if (toggle === 'off') {
                        modData[groupId].settings.capsFilter = false;
                        saveModData(modData);
                        return extra.reply('❌ Caps filter *OFF*');
                    }
                    return extra.reply(`🔠 Caps filter: ${modData[groupId].settings.capsFilter ? '✅ ON' : '❌ OFF'}\nUsage: \`.automod caps on/off <percent>\``);
                }

                case 'spam': {
                    const toggle = args[1]?.toLowerCase();
                    if (toggle === 'on') {
                        updateGroupSettings(groupId, { antiSpam: true });
                        return extra.reply('✅ Spam protection *ON*');
                    } else if (toggle === 'off') {
                        updateGroupSettings(groupId, { antiSpam: false });
                        return extra.reply('❌ Spam protection *OFF*');
                    }
                    const settings = getGroupSettings(groupId);
                    return extra.reply(`🛡️ Spam protection: ${settings.antiSpam ? '✅ ON' : '❌ OFF'}\nUsage: \`.automod spam on/off\``);
                }

                case 'warn-action': {
                    const actionType = args[1]?.toLowerCase();
                    if (!['warn', 'kick', 'mute'].includes(actionType)) {
                        return extra.reply('❌ Action must be: warn, kick, or mute');
                    }
                    modData[groupId].settings.defaultAction = actionType;
                    saveModData(modData);
                    return extra.reply(`✅ Default moderation action: *${actionType}*`);
                }

                case 'status': {
                    const data = modData[groupId];
                    const settings = getGroupSettings(groupId);
                    return extra.reply(
                        `🛡️ *Moderation Status*\n\n` +
                        `🚫 Banned words: ${data.bannedWords.length}\n` +
                        `🔗 Link protection: ${data.settings.linkProtection ? '✅ ON' : '❌ OFF'}\n` +
                        `🔠 Caps filter: ${data.settings.capsFilter ? '✅ ON' : '❌ OFF'} (${data.settings.capsPercent || 70}%)\n` +
                        `🛡️ Anti-spam: ${settings.antiSpam ? '✅ ON' : '❌ OFF'}\n` +
                        `⚡ Default action: ${data.settings.defaultAction || 'warn'}`
                    );
                }

                default:
                    return extra.reply('❌ Unknown action. See `.automod` for help.');
            }

        } catch (error) {
            console.error('[AUTOMOD ERROR]', error);
            await extra.reply('❌ Error with auto-moderation.');
        }
    }
};
