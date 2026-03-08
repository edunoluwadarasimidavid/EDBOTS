const fs = require('fs').promises;
const path = require('path');

/**
 * Safely reads a JSON file, providing default data if it fails or is missing.
 */
async function readJson(filePath, defaultValue = {}) {
    try {
        const fullPath = path.resolve(filePath);
        const data = await fs.readFile(fullPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await writeJson(filePath, defaultValue);
            return defaultValue;
        }
        console.error(`[SafeJson] Error reading ${filePath}:`, error);
        return defaultValue;
    }
}

/**
 * Safely writes to a JSON file, ensuring the directory exists.
 */
async function writeJson(filePath, data) {
    try {
        const fullPath = path.resolve(filePath);
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fullPath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`[SafeJson] Error writing ${filePath}:`, error);
        return false;
    }
}

module.exports = { readJson, writeJson };
