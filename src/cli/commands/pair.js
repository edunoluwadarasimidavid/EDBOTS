/**
 * @file pair.js
 * @description EDBots pair command — authenticate with WhatsApp.
 * 
 * Usage:
 *   edbots pair          Interactive selection
 *   edbots pair --qr     QR code mode
 *   edbots pair --code   Pairing code mode
 */

'use strict';

const logger = require('../ui/logger');
const { ask, close } = require('../ui/prompts');
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
        logger.info('Or delete the session directory to re-pair.');
        return;
    }

    if (forceQR) {
        logger.info('Starting QR authentication...');
        process.env.EDBOTS_AUTH_MODE = 'qr';
    } else if (forceCode) {
        const phoneNumber = await ask('Enter your WhatsApp phone number (e.g., 2348012345678): ');
        const cleaned = phoneNumber.replace(/[^0-9]/g, '');
        
        if (!cleaned || cleaned.length < 8) {
            logger.error('Invalid phone number');
            process.exit(1);
        }
        
        logger.info(`Starting pairing code authentication for ${cleaned}...`);
        process.env.EDBOTS_AUTH_MODE = 'pair';
        process.env.EDBOTS_PHONE_NUMBER = cleaned;
    } else {
        // Interactive selection
        console.log('Choose a connection method:\n');
        console.log('  [1] Pairing Code');
        console.log('  [2] QR Code\n');
        
        const choice = await ask('Select an option: ');
        close();
        
        if (choice === '1') {
            const phoneNumber = await ask('Enter your WhatsApp phone number: ');
            const cleaned = phoneNumber.replace(/[^0-9]/g, '');
            
            if (!cleaned || cleaned.length < 8) {
                logger.error('Invalid phone number');
                process.exit(1);
            }
            
            process.env.EDBOTS_AUTH_MODE = 'pair';
            process.env.EDBOTS_PHONE_NUMBER = cleaned;
        } else {
            process.env.EDBOTS_AUTH_MODE = 'qr';
        }
    }

    // Launch the bot
    const { initializeCrashProtection } = require('../../../utils/crashProtector');
    const { startCleanup } = require('../../../utils/cleanup');

    initializeCrashProtection();
    startCleanup();
    configManager.syncToLegacy();

    const { startBot } = require('../../../core/engine');
    await startBot();
}

pair().catch(err => {
    logger.error('Pairing failed:', err.message);
    process.exit(1);
});
