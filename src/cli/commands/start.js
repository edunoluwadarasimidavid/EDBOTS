/**
 * @file start.js
 * @description EDBots start command - the most important CLI command.
 * 
 * Performs:
 * 1. Load configuration
 * 2. Check authentication
 * 3. If no auth: interactive selection (QR/pairing) with 20s fallback
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
 * Handle first-time authentication with interactive selection
 */
async function handleFirstTimeAuth() {
    console.log('\x1b[1m\x1b[33m╔══════════════════════════════════════════╗\x1b[0m');
    console.log('\x1b[1m\x1b[33m║           EDBots Pairing                 ║\x1b[0m');
    console.log('\x1b[1m\x1b[33m╚══════════════════════════════════════════╝\x1b[0m');
    console.log('');
    console.log('No WhatsApp account is connected.');
    console.log('');
    console.log('Choose a connection method:');
    console.log('');
    console.log('  [1] Pairing Code');
    console.log('  [2] QR Code');
    console.log('');

    // If explicit flags were provided, skip interactive selection
    if (forceQR) {
        logger.info('QR mode selected via --qr flag');
        await startWithQR();
        return;
    }
    if (forcePair) {
        logger.info('Pairing code mode selected via --pair flag');
        await startWithPairingCode();
        return;
    }

    // Interactive selection: single-line countdown, instant keypress,
    // 20s timeout with QR fallback (headless-safe default).
    const mode = await selectAuthMethod();
    if (mode === 'pair') {
        await startWithPairingCode();
    } else {
        await startWithQR();
    }
}

/**
 * Interactive auth-method selection.
 *
 * UX requirements:
 * - The countdown stays on ONE line (in-place rewrite, never wraps or jumps).
 * - Pressing 1 or 2 is acknowledged IMMEDIATELY (no Enter needed).
 * - Any other key is ignored; the countdown keeps running.
 * - 20-second timeout falls back to QR Code (headless-safe default).
 * - Ctrl+C still exits cleanly (raw mode swallows SIGINT).
 * - Piped/closed stdin (no TTY) goes straight to QR instead of hanging.
 */
function selectAuthMethod() {
    const TIMEOUT_SECONDS = Number(process.env.EDBOTS_SELECT_TIMEOUT) || 20;

    // Headless / piped stdin (no TTY): keypresses are impossible -> QR directly.
    const canUseRaw =
        process.stdin.isTTY === true &&
        typeof process.stdin.setRawMode === 'function';

    if (!canUseRaw) {
        logger.info('No interactive terminal detected. Switching to QR Code mode...\n');
        return Promise.resolve('qr');
    }

    return new Promise((resolve) => {
        let settled = false;
        let remaining = TIMEOUT_SECONDS;

        // Deliberately short prompt so it never wraps, even on narrow
        // Termux screens (the menu options are printed above).
        const PROMPT = 'Your choice (auto-QR in ';
        const PAD = '    ';

        const clearLine = () => {
            process.stdout.write('\r' + ' '.repeat(PROMPT.length + PAD.length + 6) + '\r');
        };

        const render = () => {
            // \r rewrite on the SAME line — never emits a newline.
            process.stdout.write(`\r${PROMPT}${remaining}s): ${PAD}`);
        };

        const cleanup = () => {
            clearInterval(tickInterval);
            clearTimeout(timeoutId);
            process.stdin.removeListener('data', onData);
            try { process.stdin.setRawMode(false); } catch (e) { /* already off */ }
        };

        const finish = (mode, label) => {
            if (settled) return;
            settled = true;
            cleanup();
            clearLine();
            logger.success(`${label} selected`);
            resolve(mode);
        };

        const onData = (buf) => {
            const key = buf.toString('utf8');
            if (key.includes('\u0003')) { // Ctrl+C (raw mode swallows SIGINT)
                process.stdout.write('\n');
                process.exit(0);
            }
            const ch = key.charAt(0);
            if (ch === '1') finish('pair', 'Pairing Code');
            else if (ch === '2') finish('qr', 'QR Code');
            // Any other key: ignored, countdown continues.
        };

        const tickInterval = setInterval(() => {
            if (settled) return;
            remaining -= 1;
            if (remaining > 0) render();
        }, 1000);

        const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            clearLine();
            logger.warn(`No option selected (${TIMEOUT_SECONDS}s timeout)`);
            logger.info('Switching to QR Code mode...\n');
            resolve('qr');
        }, TIMEOUT_SECONDS * 1000);

        process.stdin.resume();
        process.stdin.setRawMode(true);
        process.stdin.on('data', onData);
        render();
    });
}

/**
 * Start the bot with QR code authentication
 */
async function startWithQR() {
    logger.info('Starting QR authentication...\n');
    
    // Set environment variable so connection.js knows to use QR
    process.env.EDBOTS_AUTH_MODE = 'qr';
    
    await launchBot();
}

/**
 * Start the bot with pairing code authentication
 */
async function startWithPairingCode() {
    const { ask, close } = require('../ui/prompts');
    
    console.log('');
    const phoneNumber = await ask('Enter your WhatsApp phone number (e.g., 2348012345678): ');
    close();

    const cleaned = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleaned || cleaned.length < 8) {
        logger.error('Invalid phone number');
        logger.info('Please enter a valid number with country code');
        process.exit(1);
    }

    logger.info(`Starting pairing code authentication for ${cleaned}...\n`);
    
    // Set environment variable so connection.js knows to use pairing
    process.env.EDBOTS_AUTH_MODE = 'pair';
    process.env.EDBOTS_PHONE_NUMBER = cleaned;
    
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
