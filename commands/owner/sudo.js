/**
 * Sudo Command - Manage trusted users (sudo users)
 * Sudo users get elevated permissions similar to the owner
 */

const fs = require('fs');
const path = require('path');
const { normalizeNumber } = require('../../utils/helpers');

const SUDO_FILE = path.join(__dirname, '../../data/sudoUsers.json');

function loadSudoUsers() {
    try {
        if (!fs.existsSync(SUDO_FILE)) {
            fs.writeFileSync(SUDO_FILE, JSON.stringify({ users: [] }));
            return { users: [] };
        }
        return JSON.parse(fs.readFileSync(SUDO_FILE, 'utf8'));
    } catch (e) {
        return { users: [] };
    }
}

function saveSudoUsers(data) {
    try {
        const dir = path.dirname(SUDO_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SUDO_FILE, JSON.stringify(data, null, 2));
    } catch (e) {}
}

module.exports = {
    name: 'sudo',
    aliases: ['trusted', 'moderator'],
    category: 'owner',
    description: 'Manage sudo (trusted) users',
    usage: '.sudo <add/remove/list> [user]',
    ownerOnly: true,

    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                return extra.reply(
                    `👑 *Sudo User Management*\n\n` +
                    `*Actions:*\n` +
                    `• \`.sudo add @user\` - Add sudo user\n` +
                    `• \`.sudo remove @user\` - Remove sudo user\n` +
                    `• \`.sudo list\` - List all sudo users\n` +
                    `• \`.sudo check @user\` - Check if user is sudo\n\n` +
                    `*Sudo users can:*\n` +
                    `• Use owner-level commands\n` +
                    `• Manage group settings\n` +
                    `• Access restricted features`
                );
            }

            const action = args[0].toLowerCase();
            const data = loadSudoUsers();

            switch (action) {
                case 'add': {
                    // Get mentioned user or replied user
                    const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
                    const mentioned = ctx.mentionedJid || [];
                    const targetUser = mentioned[0] || ctx.participant;

                    if (!targetUser) {
                        return extra.reply('❌ Please mention or reply to a user to add as sudo.');
                    }

                    const normalized = normalizeNumber(targetUser);
                    if (data.users.includes(normalized)) {
                        return extra.reply(`⚠️ @${targetUser.split('@')[0]} is already a sudo user.`);
                    }

                    data.users.push(normalized);
                    saveSudoUsers(data);

                    return sock.sendMessage(extra.from, {
                        text: `✅ *Sudo User Added!*\n\n👤 @${targetUser.split('@')[0]} is now a sudo user.\nThey can use owner-level commands.`,
                        mentions: [targetUser]
                    }, { quoted: msg });
                }

                case 'remove':
                case 'rm': {
                    const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
                    const mentioned = ctx.mentionedJid || [];
                    const targetUser = mentioned[0] || ctx.participant;

                    if (!targetUser) {
                        return extra.reply('❌ Please mention or reply to a user to remove.');
                    }

                    const normalized = normalizeNumber(targetUser);
                    const idx = data.users.indexOf(normalized);
                    if (idx === -1) {
                        return extra.reply(`❌ @${targetUser.split('@')[0]} is not a sudo user.`);
                    }

                    data.users.splice(idx, 1);
                    saveSudoUsers(data);

                    return sock.sendMessage(extra.from, {
                        text: `✅ *Sudo User Removed!*\n\n@${targetUser.split('@')[0]} is no longer a sudo user.`,
                        mentions: [targetUser]
                    }, { quoted: msg });
                }

                case 'list':
                case 'ls': {
                    if (data.users.length === 0) {
                        return extra.reply('📭 No sudo users configured.');
                    }

                    let text = `👑 *Sudo Users (${data.users.length}):*\n\n`;
                    data.users.forEach((user, i) => {
                        text += `${i + 1}. @${user}\n`;
                    });

                    const mentions = data.users.map(u => u + '@s.whatsapp.net');
                    return sock.sendMessage(extra.from, { text, mentions }, { quoted: msg });
                }

                case 'check': {
                    const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
                    const mentioned = ctx.mentionedJid || [];
                    const targetUser = mentioned[0] || ctx.participant || extra.sender;
                    const normalized = normalizeNumber(targetUser);
                    const isSudo = data.users.includes(normalized);

                    return sock.sendMessage(extra.from, {
                        text: isSudo
                            ? `✅ @${targetUser.split('@')[0]} *IS* a sudo user.`
                            : `❌ @${targetUser.split('@')[0]} is *NOT* a sudo user.`,
                        mentions: [targetUser]
                    }, { quoted: msg });
                }

                default:
                    return extra.reply('❌ Use `add`, `remove`, `list`, or `check`.');
            }

        } catch (error) {
            console.error('[SUDO ERROR]', error);
            await extra.reply('❌ Error managing sudo users.');
        }
    }
};
