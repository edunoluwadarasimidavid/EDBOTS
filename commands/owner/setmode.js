/**
 * SetMode Command - Switch between Personal, Business, Group, and Owner modes
 * Owner-only command to control bot behavior per chat
 */

const modeManager = require('../../utils/modeManager');

module.exports = {
    name: 'setmode',
    aliases: ['mode', 'botmode', 'switchmode'],
    category: 'owner',
    description: 'Switch bot mode (personal/business/group/owner)',
    usage: '.setmode <mode> or .setmode list',
    ownerOnly: true,

    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0 || args[0].toLowerCase() === 'list') {
                const currentMode = modeManager.getMode(extra.from);
                const modes = modeManager.getAllModes();

                let text = `🤖 *Bot Mode Control*\n\n`;
                text += `📍 *Current Mode:* ${modeManager.getModeInfo(currentMode).emoji} ${modeManager.getModeInfo(currentMode).name}\n\n`;
                text += `*Available Modes:*\n\n`;

                modes.forEach(m => {
                    const isActive = m.key === currentMode ? ' ✅' : '';
                    text += `${m.emoji} *${m.key.toUpperCase()}*${isActive}\n`;
                    text += `   ${m.description}\n`;
                    text += `   Features: ${m.features.join(', ')}\n\n`;
                });

                text += `*Usage:*\n`;
                text += `• \`.setmode personal\` - Personal assistant mode\n`;
                text += `• \`.setmode business\` - Business/professional mode\n`;
                text += `• \`.setmode group\` - Group management mode\n`;
                text += `• \`.setmode owner\` - Full admin mode\n\n`;
                text += `*Global Mode:* \`.setmode global <mode>\``;

                return extra.reply(text);
            }

            // Global mode switch
            if (args[0].toLowerCase() === 'global') {
                const mode = args[1]?.toLowerCase();
                if (!mode || !['personal', 'business', 'group', 'owner'].includes(mode)) {
                    return extra.reply('❌ Usage: `.setmode global <personal/business/group/owner>`');
                }

                // Set mode for all known chats
                const assignments = modeManager.getAllAssignments();
                for (const chatId of Object.keys(assignments)) {
                    modeManager.setMode(chatId, mode);
                }
                modeManager.setMode(extra.from, mode);

                const info = modeManager.getModeInfo(mode);
                return extra.reply(`✅ *Global Mode Set!*\n\nAll chats set to: ${info.emoji} *${info.name}*\n\n${info.description}`);
            }

            const mode = args[0].toLowerCase();
            if (!['personal', 'business', 'group', 'owner'].includes(mode)) {
                return extra.reply('❌ Invalid mode. Use `personal`, `business`, `group`, or `owner`.');
            }

            const success = modeManager.setMode(extra.from, mode);
            if (!success) {
                return extra.reply('❌ Failed to set mode.');
            }

            const info = modeManager.getModeInfo(mode);
            let text = `✅ *Mode Changed!*\n\n`;
            text += `${info.emoji} *New Mode:* ${info.name}\n\n`;
            text += `${info.description}\n\n`;
            text += `*Active Features:*\n`;
            info.features.forEach(f => {
                text += `• ${f}\n`;
            });

            await extra.reply(text);

        } catch (error) {
            console.error('[SETMODE ERROR]', error);
            await extra.reply('❌ Error changing mode.');
        }
    }
};
