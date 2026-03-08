const fs = require('fs').promises;
const path = require('path');

/**
 * Safely reads a JSON file.
 */
async function readJson(filePath, defaultValue = {}) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await writeJson(filePath, defaultValue);
            return defaultValue;
        }
        return defaultValue;
    }
}

/**
 * Safely writes to a JSON file.
 */
async function writeJson(filePath, data) {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`[SafeJson] Write Error: ${filePath}`, error);
        return false;
    }
}

module.exports = { readJson, writeJson };
