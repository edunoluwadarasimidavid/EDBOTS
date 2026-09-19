/**
 * Menu Command - Context-aware command display
 * Shows different menus based on chat type and user role
 */

const { getFormattedUptime } = require('../../utils/uptime');
const config = require('../../config');

module.exports = {
    name: 'menu',
    description: 'Displays the EDBOT AI system menu',
    category: 'menu',
    aliases: ['help', 'h', 'commands'],
    usage: '.menu',
    visibility: 'public',
    async handler(context) {
        const { sock, msg, commands, prefix, isOwner, isAdmin, isGroup } = context;

        // 1. DYNAMIC IDENTITY RESOLUTION
        const botNumber = sock?.user?.id ? sock.user.id.split(":")[0] : "Unknown";
        const pushName = msg.pushName || "User";
        const runtime = getFormattedUptime() || "0h 0m 0s";

        // DYNAMIC OWNER RESOLUTION
        const ownerPushName = sock?.user?.name || config.ownerName?.[0] || "EDBOTS Owner";
        const ownerNumber = sock?.user?.id ? sock.user.id.split("@")[0].split(":")[0] : config.owner?.[0];
        const ownerDisplayName = ownerPushName || ownerNumber;

        const mode = config.selfMode ? "Self (Private)" : "Public (Global)";

        let chatId = msg.key.remoteJid;
        if (msg.key.fromMe && sock?.user?.id) {
            chatId = sock.user.id.split(":")[0] + "@s.whatsapp.net";
        }

        try {
            // 2. BUILD A FILTER ENGINE (STRICT CONTEXT RULES)
            const uniqueCommands = commands instanceof Map ? new Set(commands.values()) : new Set();

            const visibleCommands = Array.from(uniqueCommands).filter(cmd => {
                const vis = cmd.visibility || 'public';

                // Hidden commands never show
                if (vis === 'hidden') return false;

                // Owner-only commands: only show to owner
                if (cmd.ownerOnly && !isOwner) return false;

                // Admin commands: show to admin or owner
                if (cmd.adminOnly && !isAdmin && !isOwner) return false;

                // Group-only commands: only show in groups
                if (cmd.groupOnly && !isGroup) return false;

                // Private chat: exclude group/admin categories
                if (!isGroup) {
                    const cat = (cmd.category || "").toLowerCase();
                    const restrictedInPrivate = ['admin', 'group', 'moderation'];
                    if (restrictedInPrivate.includes(cat)) return false;
                    if (cmd.groupOnly) return false;
                }

                return true;
            });

            // 3. GROUPING & HIDING EMPTY CATEGORIES
            const grouped = {};
            visibleCommands.forEach((cmd) => {
                const category = (cmd.category || "GENERAL").toUpperCase().trim();
                if (!grouped[category]) grouped[category] = [];

                if (!grouped[category].includes(cmd.name)) {
                    grouped[category].push(cmd.name);
                }
            });

            // 4. HEADER CONSTRUCTION
            const menuTitle = isGroup
                ? (isAdmin || isOwner ? "🛡️ ADMIN MENU" : "👥 GROUP MENU")
                : "📱 PERSONAL MENU";

            let menuText = `╭━━━〔 ${menuTitle} 〕━━━⬣\n`;
            menuText += `┃ 👤 User: ${pushName.toUpperCase()}\n`;
            menuText += `┃ 👑 Owner: ${ownerDisplayName}\n`;
            menuText += `┃ 🔢 Bot: ${botNumber}\n`;
            menuText += `┃ 🏁 Prefix: ${prefix}\n`;
            menuText += `┃ ⏱️ Runtime: ${runtime}\n`;
            menuText += `┃ ⚙️ Mode: ${mode}\n`;
            if (isGroup) {
                menuText += `┃ 📍 Role: ${isOwner ? 'Owner' : isAdmin ? 'Admin' : 'Member'}\n`;
            }
            menuText += `╰━━━━━━━━━━━━━━━━⬣\n\n`;

            // 5. DYNAMIC CATEGORY BLOCKS
            const sortedCategories = Object.keys(grouped).sort();

            for (const cat of sortedCategories) {
                // Skip group/admin categories in private chat
                if (!isGroup && ['ADMIN', 'GROUP', 'MODERATION'].includes(cat)) continue;

                menuText += `╭━━━〔 ${cat} 〕━━━⬣\n`;
                const categoryCommands = grouped[cat].sort();

                categoryCommands.forEach(cmdName => {
                    menuText += `┃ • ${prefix}${cmdName}\n`;
                });

                menuText += `╰━━━━━━━━━━━━━━━⬣\n\n`;
            }

            // 6. FOOTER
            menuText += `💡 *Quick Commands:*\n`;
            menuText += `• ${prefix}start - Quick command list\n`;
            menuText += `• ${prefix}ai <question> - Ask AI\n`;
            menuText += `• ${prefix}menu - This menu\n`;

            // 7. DELIVERY
            await sock.sendMessage(chatId, {
                text: menuText.trim(),
                contextInfo: {
                    externalAdReply: {
                        title: `EDBOTS AI SYSTEM v3.0`,
                        body: `Role-Based Automation Framework`,
                        thumbnailUrl: "https://github.com/edunoluwadarasimidavid.png",
                        sourceUrl: config.social?.github || "https://github.com/EDBOTS",
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: msg });

        } catch (err) {
            console.error("[MENU ERROR]", err);
            try {
                await context.reply("❌ Error rendering system menu. Contact admin.");
            } catch (e) {}
        }
    }
};
