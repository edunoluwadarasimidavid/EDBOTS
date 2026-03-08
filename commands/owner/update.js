const { readJson, writeJson } = require('../../utils/safeJson');
const { incrementVersion } = require('../../utils/versionManager');
const path = require('path');

const BOT_CONFIG = path.join(__dirname, '../../config/bot.json');

module.exports = {
    name: 'update',
    description: 'Increments and reloads the bot version',
    category: 'owner',
    ownerOnly: true,
    async execute(sock, msg, args, extra) {
        try {
            const bot = await readJson(BOT_CONFIG, {
                version: "1.0.6",
                prefix: ".",
                owner: "Edun Oluwadarasimi David"
            });

            const oldVersion = bot.version;
            bot.version = incrementVersion(oldVersion);

            await writeJson(BOT_CONFIG, bot);

            await sock.sendMessage(msg.key.remoteJid, { text: `✅ *EDBOTS updated to version ${bot.version}*` }, { quoted: msg });
        } catch (error) {
            console.error('Update command error:', error);
        }
    }
};
