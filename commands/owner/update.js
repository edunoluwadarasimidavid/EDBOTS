const { getLatestTag, checkoutTag } = require('../../utils/versionManager');
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
            await extra.reply('⏳ *Fetching latest updates from repository...*');

            const latestTag = await getLatestTag();
            if (!latestTag) {
                return await extra.reply('❌ No git tags found in the repository.');
            }

            // Load config
            const bot = await readJson(BOT_CONFIG, {});
            if (bot.version === latestTag) {
                return await extra.reply(`✅ *EDBOTS is already up to date (Version: ${latestTag})*`);
            }

            await extra.reply(`🚀 *New version detected: ${latestTag}*\nUpdating and checking out...`);

            const checkedOut = await checkoutTag(latestTag);
            if (!checkedOut) {
                return await extra.reply('❌ Failed to checkout the latest tag. Ensure your local repo is clean.');
            }

            // Update config.json
            bot.version = latestTag;
            await writeJson(BOT_CONFIG, bot);

            await extra.reply(`✅ *EDBOTS successfully updated to ${latestTag}*.\nRestarting bot in 2 seconds...`);

            // Save restart flag
            await setRestartFlag(chatId);

            // Trigger restart
            setTimeout(() => process.exit(0), 2000);

        } catch (error) {
            console.error('[Update Error]', error);
            await extra.reply('❌ An error occurred during the update process.');
        }
    }
};
