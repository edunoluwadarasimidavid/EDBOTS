/**
 * Start Command - Public entry point with themed UI
 * Context-aware: shows different commands based on chat type and user role
 */

const { getFormattedUptime } = require('../../utils/uptime');
const { buildMenu, linkPreview } = require('../../utils/menuRenderer');
const config = require('../../config');

module.exports = {
    name: 'start',
    aliases: ['begin', 'go', 'hi', 'hello', 'hey'],
    category: 'general',
    description: 'Show available commands based on your context',
    usage: '.start',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            const { commands, prefix, isOwner, isAdmin, isGroup } = extra;
            const pushName = msg.pushName || "User";
            const runtime = getFormattedUptime() || "0h 0m";

            const uniqueCommands = commands instanceof Map ? new Set(commands.values()) : new Set();

            // Filter by context
            const visible = Array.from(uniqueCommands).filter(cmd => {
                const vis = cmd.visibility || 'public';
                if (vis === 'hidden') return false;
                if (cmd.ownerOnly && !isOwner) return false;
                if (cmd.groupOnly && !isGroup) return false;
                if (cmd.adminOnly && !isAdmin && !isOwner) return false;
                if (!isGroup) {
                    const cat = (cmd.category || '').toLowerCase();
                    if (['admin', 'group', 'moderation'].includes(cat)) return false;
                }
                return true;
            });

            // Group by category
            const grouped = {};
            visible.forEach(cmd => {
                const cat = (cmd.category || 'general').toLowerCase().trim();
                if (!grouped[cat]) grouped[cat] = [];
                if (!grouped[cat].includes(cmd.name)) grouped[cat].push(cmd.name);
            });

            const ORDER = ['general', 'ai', 'fun', 'media', 'utility', 'business', 'group', 'admin', 'system', 'menu'];
            const ordered = ORDER.filter(c => grouped[c]).map(c => ({ name: c, commands: grouped[c] }));
            const rest = Object.keys(grouped)
                .filter(c => !ORDER.includes(c))
                .sort()
                .map(c => ({ name: c, commands: grouped[c] }));

            const categories = [...ordered, ...rest];

            const title = isGroup ? '👥 GROUP START' : '✨ EDBOTS';
            const subtitle = isGroup
                ? `Role: ${isOwner ? 'Owner' : isAdmin ? 'Admin' : 'Member'}`
                : `Hey ${pushName}! 👋`;

            const { text } = buildMenu({
                title,
                subtitle,
                userName: pushName,
                botNumber: '',
                ownerName: '',
                prefix,
                uptime: runtime,
                mode: '',
                categories,
                isStart: true
            });

            await sock.sendMessage(extra.from, {
                text: text.trim(),
                contextInfo: { externalAdReply: linkPreview() }
            }, { quoted: msg });

        } catch (error) {
            console.error('[START ERROR]', error);
            await extra.reply('❌ Error loading commands. Type .menu for help.');
        }
    }
};
