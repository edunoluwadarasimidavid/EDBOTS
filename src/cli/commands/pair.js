/**
 * @file pair.js
 * @description EDBots pair command — authenticate with WhatsApp.
 *
 * Usage:
 *   edbots pair          Interactive selection (1 = QR, 2 = Pairing)
 *   edbots pair --qr     QR code mode
 *   edbots pair --code   Pairing code mode
 */

'use strict';

const logger = require('../ui/logger');
const configManager = require('../../config/manager');

const args = process.argv.slice(3);
const forceQR = args.includes('--qr');
const forceCode = args.includes('--code');

async function pair() {
    logger.banner();
    logger.info('EDBots WhatsApp Pairing\n');

    // Load config
    configManager.load();

    // Check if already authenticated
    const fs = require('fs');
    const path = require('path');
    const sessionDir = path.join(process.cwd(), configManager.get('bot.sessionName') || 'session');

    if (fs.existsSync(path.join(sessionDir, 'creds.json'))) {
        logger.warn('Already authenticated!');
        logger.info('Run "edbots start" to use the bot.');
        logger.info('Or run "edbots logout" to disconnect and re-pair.');
        return;
    }

    const { selectAuth, selectAuthMethod, promptForPhoneNumber, applyAuthEnv } = require('./authSelect');

    if (forceQR) {
        logger.info('Starting QR authentication...');
        applyAuthEnv({ mode: 'qr' });
    } else if (forceCode) {
        const phoneNumber = await promptForPhoneNumber();
        logger.info(`Starting pairing code authentication for ${phoneNumber}...`);
        applyAuthEnv({ mode: 'pair', phoneNumber });
    } else {
        // Interactive selection — same menu as `edbots start` (no timer).
        const selection = await selectAuth();
        applyAuthEnv(selection);
    }

    // Launch the bot
    const { initializeCrashProtection } = require('../../../utils/crashProtector');
    const { startCleanup } = require('../../../utils/cleanup');

    initializeCrashProtection();
    startCleanup();
    configManager.syncToLegacy();

    logger.info('Initializing EDBots System...\n');

    const { startBot } = require('../../../core/engine');
    await startBot();
}

pair().catch(err => {
    logger.error('Pairing failed:', err.message);
    process.exit(1);
});
