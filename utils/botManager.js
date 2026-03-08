const fs = require('fs').promises;
const path = require('path');

const BOT_CONFIG_PATH = path.join(__dirname, '..', 'config', 'bot.json');
const OWNER_MENU_PATH = path.join(__dirname, '..', 'data', 'ownerMenu.json');

/**
 * Reads a JSON file safely
 */
async function readJson(filePath, defaultValue = {}) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
            return defaultValue;
        }
        return defaultValue;
    }
}

/**
 * Writes to a JSON file safely
 */
async function writeJson(filePath, data) {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing JSON to ${filePath}:`, error);
        return false;
    }
}

/**
 * Formats process uptime into "Xh Xm"
 */
function getFormattedUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

/**
 * Increments version string following the rule:
 * 1.0.6 -> 1.0.7
 * 1.0.9 -> 1.1.0
 * 1.9.9 -> 2.0.0
 */
function incrementVersion(version) {
    let parts = version.split('.').map(Number);
    if (parts.length !== 3) return "1.0.0"; // Fallback
    
    parts[2]++; // Increment patch
    
    if (parts[2] > 9) {
        parts[2] = 0;
        parts[1]++; // Increment minor
    }
    
    if (parts[1] > 9) {
        parts[1] = 0;
        parts[0]++; // Increment major
    }
    
    return parts.join('.');
}

module.exports = {
    readJson,
    writeJson,
    getFormattedUptime,
    incrementVersion,
    BOT_CONFIG_PATH,
    OWNER_MENU_PATH
};
