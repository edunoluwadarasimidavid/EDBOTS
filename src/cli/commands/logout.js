/**
 * @file logout.js
 * @description EDBots logout command — removes WhatsApp session and resets everything.
 * 
 * After logout, running `edbots start` will trigger a fresh authentication
 * (pairing code or QR code) from scratch.
 * 
 * Usage:
 *   edbots logout          Interactive logout (asks for confirmation)
 *   edbots logout --force  Logout without confirmation
 */

'use strict';

const fs = require('fs');
const fse = (() => { try { return require('fs-extra'); } catch (e) { return fs; } })();
const path = require('path');
const logger = require('../ui/logger');
const { ask, askYesNo, close } = require('../ui/prompts');
const configManager = require('../../config/manager');

const args = process.argv.slice(3);
const force = args.includes('--force') || args.includes('-f');

async function logout() {
    logger.banner();
    logger.info('EDBots Logout\n');

    configManager.load();

    const sessionDir = path.join(process.cwd(), configManager.get('bot.sessionName') || 'session');
    const credsFile = path.join(sessionDir, 'creds.json');

    // Check if authenticated
    if (!fs.existsSync(credsFile)) {
        logger.warn('No WhatsApp account is currently connected.');
        logger.info('EDBots is already logged out.');
        return;
    }

    // Show what will be removed
    let sessionFiles = [];
    try {
        sessionFiles = fs.readdirSync(sessionDir);
    } catch (e) {}

    console.log('\x1b[1m\x1b[33m⚠ This will:\x1b[0m\n');
    console.log('  • Disconnect your WhatsApp account from EDBots');
    console.log(`  • Delete the session data (${sessionFiles.length} files)`);
    console.log('  • Clear temporary files and caches');
    console.log('  • Keep your configuration (edbots customize)');
    console.log('');
    console.log('  After logout, `edbots start` will ask you to pair');
    console.log('  again using a QR code or pairing code.\n');

    // Confirmation
    let confirmed = force;
    if (!confirmed) {
        confirmed = await askYesNo('Are you sure you want to logout?', false);
        close();
    }

    if (!confirmed) {
        logger.info('Logout cancelled.');
        return;
    }

    // Stop running bot first
    logger.info('Stopping bot if running...');
    try {
        const { execSync } = require('child_process');
        const result = execSync('pgrep -f "node.*index.js" 2>/dev/null || true', { encoding: 'utf8' });
        const pids = result.trim().split('\n').filter(p => p.trim());
        pids.forEach(pid => {
            try {
                process.kill(parseInt(pid), 'SIGTERM');
            } catch (e) {}
        });
        if (pids.length > 0) {
            // Wait for graceful shutdown
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (e) {}

    // Backup session before deletion (safety)
    const backupDir = path.join(process.cwd(), `session_backup_${Date.now()}`);
    try {
        if (fs.existsSync(sessionDir)) {
            fse.copySync(sessionDir, backupDir);
            logger.success(`Session backed up to: ${path.basename(backupDir)}`);
        }
    } catch (e) {
        logger.warn('Could not create backup (continuing anyway)');
    }

    // Delete session directory
    logger.info('Removing WhatsApp session...');
    try {
        fse.removeSync(sessionDir);
        logger.success('Session deleted');
    } catch (e) {
        logger.error('Failed to delete session:', e.message);
        process.exit(1);
    }

    // Clear temp files
    logger.info('Clearing temporary files...');
    try {
        const tempDir = path.join(process.cwd(), 'temp');
        if (fs.existsSync(tempDir)) {
            fse.emptyDirSync(tempDir);
            logger.success('Temp files cleared');
        }
    } catch (e) {
        logger.warn('Could not clear temp files');
    }

    // Clear auth-related env vars if set
    delete process.env.EDBOTS_AUTH_MODE;
    delete process.env.EDBOTS_PHONE_NUMBER;

    console.log('\n');
    logger.success('Logout complete! 🎉');
    logger.info('EDBots has been disconnected from WhatsApp.');
    logger.info('');
    logger.info('Next steps:');
    logger.info('  \x1b[36medbots start\x1b[0m  →  Pair again with QR or pairing code');
    console.log('');
}

logout().catch(err => {
    logger.error('Logout failed:', err.message);
    process.exit(1);
});
