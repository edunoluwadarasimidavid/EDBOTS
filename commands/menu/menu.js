/**
 * Menu Command - Themed, customizable menu with Git repository card
 */

const { getFormattedUptime } = require('../../utils/uptime');
const { buildMenu, linkPreview } = require('../../utils/menuRenderer');
const config = require('../../config');

module.exports = {
    name: 'menu',
    description: 'Displays the EDBots themed menu',
    category: 'menu',
    aliases: ['help', 'h', 'commands'],
    usage: '.menu',
    visibility: 'public',
    async handler(context) {
        const { sock, msg, commands, prefix, isOwner, isAdmin, isGroup } = context;

        const botNumber = sock?.user?.id ? sock.user.id.split(":")[0] : "Unknown";
        const pushName = msg.pushName || "User";
        const runtime = getFormattedUptime() || "0h 0m";

        const ownerPushName = sock?.user?.name || config.ownerName?.[0] || "EDBots Owner";
        const ownerDisplayName = ownerPushName;
        const mode = config.selfMode ? "Self (Private)" : "Public (Global)";

        let chatId = msg.key.remoteJid;
        if (msg.key.fromMe && sock?.user?.id) {
            chatId = sock.user.id.split(":")[0] + "@s.whatsapp.net";
        }

        try {
            // 1. Filter visible commands by context (same rules as before)
            const uniqueCommands = commands instanceof Map ? new Set(commands.values()) : new Set();

            const visibleCommands = Array.from(uniqueCommands).filter(cmd => {
                const vis = cmd.visibility || 'public';

                if (vis === 'hidden') return false;
                if (cmd.ownerOnly && !isOwner) return false;
                if (cmd.adminOnly && !isAdmin && !isOwner) return false;
                if (cmd.groupOnly && !isGroup) return false;

                if (!isGroup) {
                    const cat = (cmd.category || "").toLowerCase();
                    const restrictedInPrivate = ['admin', 'group', 'moderation'];
                    if (restrictedInPrivate.includes(cat)) return false;
                    if (cmd.groupOnly) return false;
                }
                return true;
            });

            // 2. Group by category
            const grouped = {};
            visibleCommands.forEach((cmd) => {
                const category = (cmd.category || "general").toLowerCase().trim();
                if (!grouped[category]) grouped[category] = [];
                if (!grouped[category].includes(cmd.name)) {
                    grouped[category].push(cmd.name);
                }
            });

            // 3. Order categories meaningfully
            const ORDER = ['general', 'ai', 'fun', 'media', 'utility', 'business', 'group', 'admin', 'owner', 'system', 'menu'];
            const ordered = ORDER.filter(c => grouped[c]).map(c => ({ name: c, commands: grouped[c] }));
            const rest = Object.keys(grouped)
                .filter(c => !ORDER.includes(c))
                .sort()
                .map(c => ({ name: c, commands: grouped[c] }));

            const categories = [...ordered, ...rest];

            // 4. Role-aware title
            const menuTitle = isGroup
                ? (isAdmin || isOwner ? "🛡️ ADMIN MENU" : "👥 GROUP MENU")
                : "📱 PERSONAL MENU";

            const subtitle = isGroup
                ? `Role: ${isOwner ? 'Owner' : isAdmin ? 'Admin' : 'Member'}`
                : 'Private Chat';

            // 5. Render themed menu
            const { text } = buildMenu({
                title: menuTitle,
                subtitle,
                userName: pushName.toUpperCase(),
                botNumber,
                ownerName: ownerDisplayName,
                prefix,
                uptime: runtime,
                mode,
                categories
            });

            // 6. Send with GitHub link preview
            await sock.sendMessage(chatId, {
                text: text.trim(),
                contextInfo: { externalAdReply: linkPreview() }
            }, { quoted: msg });

        } catch (err) {
            console.error("[MENU ERROR]", err);
            try {
                await context.reply("❌ Error rendering system menu. Contact admin.");
            } catch (e) {}
        }
    }
};
