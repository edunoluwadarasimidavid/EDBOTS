const { getFormattedUptime } = require('../../utils/uptime');
const config = require('../../config');

module.exports = {
    name: 'menu',
    description: 'Displays the dynamic command menu',
    category: 'menu',
    aliases: ['help', 'h'],
    async execute(sock, msg, args, context) {
        try {
            const { commands, reply, prefix } = context;
            const uptime = getFormattedUptime();
            const botName = config.botName || 'EDBOTS';
            const ownerName = Array.isArray(config.ownerName) ? config.ownerName[0] : config.ownerName;

            // Handle Help for specific command
            if (args[0]) {
                const cmd = commands.get(args[0].toLowerCase());
                if (cmd) {
                    let helpText = `╭─╼─≪ *COMMAND HELP* ≫─╼─╮\n`;
                    helpText += `│ 🏷️ *Name:* ${cmd.name}\n`;
                    helpText += `│ 📚 *Description:* ${cmd.description || cmd.desc || 'No description'}\n`;
                    helpText += `│ 📂 *Category:* ${cmd.category || 'general'}\n`;
                    if (cmd.aliases && cmd.aliases.length > 0) {
                        helpText += `│ 🔗 *Aliases:* ${cmd.aliases.join(', ')}\n`;
                    }
                    if (cmd.usage) {
                        helpText += `│ ⌨️ *Usage:* ${prefix}${cmd.name} ${cmd.usage}\n`;
                    }
                    helpText += `╰╼━━━━━━━━━━━━━━━╾╯`;
                    return await reply(helpText);
                }
            }

            // Group unique commands by category
            const categories = {};
            const uniqueCommands = new Set(commands.values());

            uniqueCommands.forEach((cmd) => {
                const cat = cmd.category || 'general';
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(cmd.name);
            });

            let menuText = `╭─╼─≪ *${botName.toUpperCase()}* ≫─╼─╮
│ 🤖 *Owner:* ${ownerName}
│ ⏱️ *Uptime:* ${uptime}
│ 👑 *Prefix:* [ ${prefix} ]
│ ⚙️ *Version:* 1.1.0
╰╼━━━━━━━━━━━━━━━╾╯\n\n`;

            const sortedCategories = Object.keys(categories).sort();

            sortedCategories.forEach(cat => {
                menuText += `╭╼━≪ 🌟 *${cat.toUpperCase()}* ≫━╾╮\n`;
                // Sort command names within category
                categories[cat].sort().forEach(cmdName => {
                    menuText += `┃ • ${prefix}${cmdName}\n`;
                });
                menuText += `╰━━━━━━━━━━━━━━━╯\n\n`;
            });

            menuText += `> *Type ${prefix}help <command> for details*\n\n`;
            menuText += `*© 2026 EDBOTS Framework*`;

            await sock.sendMessage(msg.key.remoteJid, { 
                text: menuText.trim(),
                contextInfo: {
                    externalAdReply: {
                        title: `${botName} Assistant`,
                        body: `Dynamic Command System Active`,
                        thumbnailUrl: "https://github.com/edunoluwadarasimidavid.png",
                        sourceUrl: config.social?.github || "",
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: msg });

        } catch (error) {
            console.error('[Menu Error]', error);
            context.reply('❌ Failed to generate menu.');
        }
    }
};
