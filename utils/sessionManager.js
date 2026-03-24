/**
 * @file sessionManager.js
 * @description Advanced session management, cleanup, and atomic write safety.
 */

const fs = require('fs-extra');
const path = require('path');
const { DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

/**
 * Handles Baileys 401 error and performs specific cleanup.
 */
async function handleAuthFailure(error, sessionDir) {
    const reason = new Boom(error)?.output?.statusCode;
    
    if (reason === DisconnectReason.loggedOut || reason === 401) {
        console.warn('\x1b[31m[AUTH] Invalid session detected\x1b[0m');
        
        try {
            if (await fs.pathExists(sessionDir)) {
                const backupDir = path.join(path.dirname(sessionDir), `session_backup_${Date.now()}`);
                await fs.copy(sessionDir, backupDir);
                console.log(`\x1b[32m[AUTH] Session backed up to: ${path.basename(backupDir)}\x1b[0m`);

                // Remove only corrupted auth files
                const corruptedFiles = [
                    'creds.json',
                    'app-state-sync-key-none.json',
                    'app-state-sync-key-high.json'
                ];

                const files = await fs.readdir(sessionDir);
                for (const file of files) {
                    if (corruptedFiles.includes(file) || file.startsWith('app-state')) {
                        await fs.remove(path.join(sessionDir, file));
                    }
                }
                
                console.log('\x1b[32m[AUTH] Corrupted auth cleaned\x1b[0m');
                console.log('\x1b[36m[AUTH] Ready for fresh pairing\x1b[0m');
                return true;
            }
        } catch (err) {
            console.error('\x1b[31m[AUTH] Cleanup failed:\x1b[0m', err.message);
        }
    }
    return false;
}

/**
 * Atomic write system to prevent session corruption.
 * Implements a simple queue-like behavior via sequential execution if called rapidly.
 */
let isWriting = false;
const writeQueue = [];

async function processQueue() {
    if (isWriting || writeQueue.length === 0) return;
    isWriting = true;
    const { filePath, data, resolve, reject } = writeQueue.shift();
    
    try {
        const tempPath = `${filePath}.tmp`;
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeJson(tempPath, data);
        await fs.move(tempPath, filePath, { overwrite: true });
        resolve();
    } catch (err) {
        reject(err);
    } finally {
        isWriting = false;
        processQueue();
    }
}

function safeWriteAuth(filePath, data) {
    return new Promise((resolve, reject) => {
        writeQueue.push({ filePath, data, resolve, reject });
        processQueue();
    });
}

module.exports = {
    handleAuthFailure,
    safeWriteAuth
};
