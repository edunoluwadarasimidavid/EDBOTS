const { readJson, writeJson } = require('./safeJson');
const path = require('path');

const RESTART_FILE = path.join(__dirname, '../data/restart_flag.json');

/**
 * Sets a flag to notify the owner after restart.
 */
async function setRestartFlag(chatId) {
    await writeJson(RESTART_FILE, { chatId, timestamp: Date.now() });
}

/**
 * Checks for a restart flag and notifies if present.
 */
async function checkRestartFlag(sock) {
    const flag = await readJson(RESTART_FILE, null);
    if (flag && flag.chatId) {
        try {
            await sock.sendMessage(flag.chatId, { text: '✅ *Restart completed successfully!*' });
            const fs = require('fs').promises;
            await fs.unlink(RESTART_FILE);
        } catch (e) {
            console.error('[RestartManager] Error sending notification:', e.message);
        }
    }
}

module.exports = { setRestartFlag, checkRestartFlag };
