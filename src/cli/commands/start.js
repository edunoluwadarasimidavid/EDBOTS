/**
 * @file start.js
 * @description EDBots start command - the most important CLI command.
 *
 * Performs:
 * 1. Load configuration
 * 2. Check authentication
 * 3. If no auth: interactive selection (1 = QR, 2 = Pairing) — NO timer
 * 4. Start the bot
 */

'use strict';

const path = require('path');
const fs = require('fs');
const logger = require('../ui/logger');
const { spinner } = require('../ui/spinner');

// Load config from the centralized config system
const configManager = require('../../config/manager');

// Parse CLI flags
const args = process.argv.slice(3); // skip 'node', 'start.js', 'start'
const forceQR = args.includes('--qr');
const forcePair = args.includes('--pair') || args.includes('--code');

/**
 * Main start command
 */
async function start() {
    logger.banner();
    logger.info('EDBots starting...\n');

    // STEP 1 — Load Configuration
    const loadSpinner = spinner('Loading configuration');
    loadSpinner.start();

    try {
        configManager.load();
        loadSpinner.stop('Configuration loaded');
    } catch (err) {
        loadSpinner.fail('Failed to load configuration');
        logger.error('Configuration error:', err.message);
        process.exit(1);
    }

    // STEP 2 — Check Authentication
    const authSpinner = spinner('Checking authentication');
    authSpinner.start();

    const sessionDir = path.join(process.cwd(), configManager.get('bot.sessionName') || 'session');
    const hasAuth = fs.existsSync(path.join(sessionDir, 'creds.json'));

    if (hasAuth) {
        authSpinner.stop('Authentication found');
        logger.success('Session detected — starting bot\n');

        // Start the existing bot engine directly
        await launchBot();
        return;
    }

    authSpinner.fail('No authentication found');

    // STEP 3 — First-time Authentication
    await handleFirstTimeAuth();
}

/**
 * Handle first-time authentication.
 *
 * No countdown / no timer / no auto-fallback — the menu waits for the
 * user to choose. 1 = QR Code, 2 = Pairing Code.
 */
async function handleFirstTimeAuth() {
    const { selectAuth, applyAuthEnv } = require('./authSelect');

    // Explicit flags skip the menu entirely
    if (forceQR) {
        logger.info('QR mode selected via --qr flag');
        applyAuthEnv({ mode: 'qr' });
        await launchBot();
        return;
    }
    if (forcePair) {
        logger.info('Pairing code mode selected via --pair flag');
        const { promptForPhoneNumber } = require('./authSelect');
        const phoneNumber = await promptForPhoneNumber();
        applyAuthEnv({ mode: 'pair', phoneNumber });
        await launchBot();
        return;
    }

    // Interactive selection — waits indefinitely for a valid choice.
    const selection = await selectAuth();
    applyAuthEnv(selection);
    await launchBot();
}

/**
 * Launch the existing bot engine
 * This wraps the original index.js startup sequence
 */
async function launchBot() {
    const { initializeCrashProtection } = require('../../../utils/crashProtector');
    const { startCleanup } = require('../../../utils/cleanup');
    const developer = require('../../../core/developer');

    // Sync config to legacy format
    configManager.syncToLegacy();

    // Initialize crash protection
    initializeCrashProtection();

    // Ensure directories exist
    const dirs = ['commands', 'session', 'temp', 'database'];
    dirs.forEach(dir => {
        const dirPath = path.join(process.cwd(), dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            logger.info(`Created directory: ${dir}`);
        }
    });

    // Start cleanup system
    startCleanup();

    logger.info('Initializing EDBots System...\n');

    // Start the bot engine (same as original index.js)
    const { startBot } = require('../../../core/engine');

    try {
        await startBot();
    } catch (err) {
        logger.error('Failed to start bot:', err.message);
        process.exit(1);
    }
}

// Run
start().catch(err => {
    logger.error('Fatal error:', err.message);
    process.exit(1);
});
