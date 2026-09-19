/**
 * Start Command - Public entry point showing available commands
 * Context-aware: shows different commands based on chat type and user role
 */

const { getFormattedUptime } = require('../../utils/uptime');
const config = require('../../config');

module.exports = {
    name: 'start',
    aliases: ['begin', 'go', 'hi', 'hello', 'hey'],
    category: 'general',
    description: 'Show available commands based on your context',
    usage: '.start',
    visibility: 'public', // Always visible to everyone

    async execute(sock, msg, args, extra) {
        try {
            const { commands, prefix, isOwner, isAdmin, isGroup } = extra;
            const pushName = msg.pushName || "User";
            const runtime = getFormattedUptime() || "0h 0m";

            // Get all unique commands
            const uniqueCommands = commands instanceof Map ? new Set(commands.values()) : new Set();

            // Filter commands based on context
            const publicCmds = [];
            const groupCmds = [];
            const adminCmds = [];
            const aiCmds = [];
            const funCmds = [];
            const mediaCmds = [];
            const utilityCmds = [];
            const businessCmds = [];

            uniqueCommands.forEach(cmd => {
                const cat = (cmd.category || '').toLowerCase();
                const vis = cmd.visibility || 'public';

                // Skip hidden and owner-only from start
                if (vis === 'hidden' || cmd.ownerOnly) return;

                // Skip group-only commands in private chat
                if (cmd.groupOnly && !isGroup) return;

                // Skip admin commands if not admin
                if (cmd.adminOnly && !isAdmin && !isOwner) return;

                // Categorize
                if (cat === 'ai') aiCmds.push(cmd.name);
                else if (cat === 'fun') funCmds.push(cmd.name);
                else if (cat === 'media') mediaCmds.push(cmd.name);
                else if (cat === 'utility' || cat === 'general') utilityCmds.push(cmd.name);
                else if (cat === 'business') businessCmds.push(cmd.name);
                else if (cat === 'group' && isGroup) groupCmds.push(cmd.name);
                else if (cat === 'admin' && (isAdmin || isOwner)) adminCmds.push(cmd.name);
                else if (vis === 'public') publicCmds.push(cmd.name);
            });

            // Build greeting
            const greetings = [
                `Hey ${pushName}! 👋`,
                `Hello ${pushName}! 🌟`,
                `Welcome ${pushName}! ✨`,
                `Hi there ${pushName}! 🎉`
            ];
            const greeting = greetings[Math.floor(Math.random() * greetings.length)];

            // Build menu
            let text = `╭━━━〔 🤖 *EDBOTS AI* 〕━━━╮\n`;
            text += `┃ ${greeting}\n`;
            text += `┃ 🏁 Prefix: ${prefix}\n`;
            text += `┃ ⏱️ Uptime: ${runtime}\n`;
            text += `┃ 📍 ${isGroup ? 'Group Chat' : 'Private Chat'}\n`;
            if (isGroup && (isAdmin || isOwner)) {
                text += `┃ 🛡️ Role: ${isOwner ? 'Owner' : 'Admin'}\n`;
            }
            text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;

            // AI Commands
            if (aiCmds.length > 0) {
                text += `╭━━━〔 🧠 *AI & CHAT* 〕━━━╮\n`;
                aiCmds.sort().forEach(cmd => {
                    text += `┃ • ${prefix}${cmd}\n`;
                });
                text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
            }

            // Fun Commands
            if (funCmds.length > 0) {
                text += `╭━━━〔 🎮 *FUN* 〕━━━╮\n`;
                funCmds.sort().forEach(cmd => {
                    text += `┃ • ${prefix}${cmd}\n`;
                });
                text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
            }

            // Media Commands
            if (mediaCmds.length > 0) {
                text += `╭━━━〔 📥 *MEDIA* 〕━━━╮\n`;
                mediaCmds.sort().forEach(cmd => {
                    text += `┃ • ${prefix}${cmd}\n`;
                });
                text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
            }

            // Utility Commands
            if (utilityCmds.length > 0) {
                text += `╭━━━〔 🔧 *UTILITY* 〕━━━╮\n`;
                utilityCmds.sort().forEach(cmd => {
                    text += `┃ • ${prefix}${cmd}\n`;
                });
                text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
            }

            // Business Commands
            if (businessCmds.length > 0) {
                text += `╭━━━〔 💼 *BUSINESS* 〕━━━╮\n`;
                businessCmds.sort().forEach(cmd => {
                    text += `┃ • ${prefix}${cmd}\n`;
                });
                text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
            }

            // Group Commands (only in groups)
            if (isGroup && groupCmds.length > 0) {
                text += `╭━━━〔 👥 *GROUP* 〕━━━╮\n`;
                groupCmds.sort().forEach(cmd => {
                    text += `┃ • ${prefix}${cmd}\n`;
                });
                text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
            }

            // Admin Commands (only for admins)
            if ((isAdmin || isOwner) && adminCmds.length > 0) {
                text += `╭━━━〔 🛡️ *ADMIN* 〕━━━╮\n`;
                adminCmds.sort().forEach(cmd => {
                    text += `┃ • ${prefix}${cmd}\n`;
                });
                text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
            }

            // Footer
            text += `💡 *Quick Start:*\n`;
            text += `• ${prefix}ai <question> - Ask AI anything\n`;
            text += `• ${prefix}menu - Full command list\n`;
            text += `• ${prefix}help - Get help\n\n`;
            text += `> _Type ${prefix}command for more info_`;

            await sock.sendMessage(extra.from, {
                text: text.trim(),
                contextInfo: {
                    externalAdReply: {
                        title: `EDBOTS AI SYSTEM`,
                        body: `Your Intelligent Assistant`,
                        thumbnailUrl: "https://github.com/edunoluwadarasimidavid.png",
                        sourceUrl: config.social?.github || "https://github.com/EDBOTS",
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: msg });

        } catch (error) {
            console.error('[START ERROR]', error);
            await extra.reply('❌ Error loading commands. Type .menu for help.');
        }
    }
};
