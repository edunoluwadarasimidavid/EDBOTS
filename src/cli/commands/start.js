/**
 * @file start.js
 * @description EDBots start command - the most important CLI command.
 * 
 * Performs:
 * 1. Load configuration
 * 2. Check authentication
 * 3. If no auth: interactive selection (QR/pairing) with 10s fallback
 * 4. Start the bot
 */

'use strict';

const path = require('path');
const fs = require('fs');
const readline = require('readline');
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

    // Interactive selection with 10-second timeout
    // Uses readline (not raw stdin) so it works over SSH, Termux, Docker
    // and any TTY. QR is the default fallback for headless environments.
    let selected = false;

    const selectRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: process.stdin.isTTY === true,
    });

    const promptText = 'Select an option (1-2): ';

    const finish = (mode) => {
        if (selected) return;
        selected = true;
        clearTimeout(timeoutId);
        clearInterval(countdownInterval);
        try { selectRl.close(); } catch (e) {}
        try { selectRl.removeAllListeners(); } catch (e) {}

        if (mode === 'pair') {
            startWithPairingCode();
        } else if (mode === 'invalid') {
            logger.warn('Invalid option. Defaulting to QR Code...\n');
            startWithQR();
        } else {
            startWithQR();
        }
    };

    // 10-second fallback timer -> QR (headless-safe default)
    let remaining = 10;
    const timeoutId = setTimeout(() => {
        if (selected) return;
        process.stdout.write('\n');
        logger.warn('No option selected (10s timeout)');
        logger.info('Switching to QR Code mode...\n');
        finish('qr');
    }, 10000);

    const countdownInterval = setInterval(() => {
        if (selected) { clearInterval(countdownInterval); return; }
        remaining -= 1;
        if (remaining > 0) {
            process.stdout.write(`\r${promptText}_ (${remaining}s)   `);
        }
    }, 1000);

    process.stdout.write(promptText);

    selectRl.on('line', (line) => {
        const answer = String(line).trim();
        if (answer === '1') finish('pair');
        else if (answer === '2') finish('qr');
        else finish('invalid');
    });

    selectRl.on('close', () => {
        // stdin ended (piped/closed input, e.g. `edbots start < /dev/null`)
        if (!selected) {
            process.stdout.write('\n');
            logger.warn('Input closed. Switching to QR Code mode...\n');
            finish('qr');
        }
    });

    selectRl.on('error', () => {
        if (!selected) finish('qr');
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
