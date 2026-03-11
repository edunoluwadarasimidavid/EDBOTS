const { getLatestTag, resetToTag, getCurrentTag } = require('../../utils/versionManager');
const { readJson, writeJson } = require('../../utils/safeJson');
const { setRestartFlag } = require('../../utils/restartManager');
const path = require('path');

const BOT_CONFIG = path.join(__dirname, '../../config/bot.json');

module.exports = {
    name: 'update',
    description: 'Syncs to latest GitHub tag and restarts',
    category: 'owner',
    ownerOnly: true,
    async execute(sock, msg, args, extra) {
        try {
            const chatId = msg.key.remoteJid;
            const currentTag = await getCurrentTag();
            
            await extra.reply(`⏳ *Checking for updates...*\n\n*Current Version:* ${currentTag}`);

            const latestTag = await getLatestTag();
            if (!latestTag) {
                return await extra.reply('❌ *Failed to fetch tags.* Ensure the repository has git tags and git is configured correctly.');
            }

            if (currentTag === latestTag) {
                return await extra.reply(`✅ *EDBOTS is already up to date!*\n\n*Version:* ${latestTag}`);
            }

            await extra.reply(`🚀 *New version detected: ${latestTag}*\n\nUpdating from ${currentTag} to ${latestTag}...\n(Note: This will reset any local changes to core files)`);

            // Use resetToTag to bypass local change conflicts
            const updated = await resetToTag(latestTag);
            if (!updated) {
                return await extra.reply('❌ *Update failed during checkout.*\n\nPossible causes:\n1. Git remote communication error.\n2. Permission issues in the Termux environment.');
            }

            // Update bot.json config with the new version
            const bot = await readJson(BOT_CONFIG, {});
            bot.version = latestTag;
            await writeJson(BOT_CONFIG, bot);

            await extra.reply(`✅ *EDBOTS successfully updated to ${latestTag}!*\n\nRestarting bot to apply changes...`);

            // Save restart flag to notify owner after reboot
            await setRestartFlag(chatId);

            // Give a short delay for message delivery before exit
            setTimeout(() => {
                process.exit(0);
            }, 2000);

        } catch (error) {
            console.error('[Update Error]', error);
            await extra.reply(`❌ *An error occurred during update:*\n${error.message}`);
        }
    }
};
