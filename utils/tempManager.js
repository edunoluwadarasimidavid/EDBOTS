/**
 * Lightweight Temp Manager
 * Handles automatic cleanup of media files to save disk and RAM.
 */
const fs = require('fs').promises;
const path = require('path');

const TEMP_DIR = path.join(__dirname, '..', 'temp');

async function ensureTempDir() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
    } catch (e) {}
}

/**
 * Automatically deletes a file after a delay
 */
async function autoDelete(filePath, delay = 60000) {
    setTimeout(async () => {
        try {
            await fs.unlink(filePath);
            console.log(` 🗑️ [Cleanup] Deleted: ${path.basename(filePath)}`);
        } catch (e) {
            // File might already be gone
        }
    }, delay);
}

/**
 * Clears all files in the temp directory
 */
async function clearTemp() {
    try {
        const files = await fs.readdir(TEMP_DIR);
        for (const file of files) {
            await fs.unlink(path.join(TEMP_DIR, file));
        }
        console.log(' 🧹 [Cleanup] Temp directory cleared.');
    } catch (e) {}
}

module.exports = { ensureTempDir, autoDelete, clearTemp, TEMP_DIR };
