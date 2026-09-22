/**
 * @file authSelect.js
 * @description Shared authentication-method selection for the EDBots CLI.
 *
 * Used by both `edbots start` and `edbots pair`.
 *
 * Behavior (per user request):
 *  - NO countdown, NO timer, NO auto-selection. The prompt simply waits
 *    as long as the user needs.
 *  - Option 1 = QR Code
 *  - Option 2 = Pairing Code (phone number)
 *  - Any other input is re-asked (never exits, never guesses).
 *  - Piped / non-TTY stdin: reads lines normally; EOF selects QR so
 *    automated runs never hang.
 */

'use strict';

const logger = require('../ui/logger');
const { ask, close } = require('../ui/prompts');

/**
 * Show the selection menu.
 * 1 = QR Code, 2 = Pairing Code.
 */
function printMenu() {
    console.log('');
    console.log('\x1b[1m\x1b[33m╔══════════════════════════════════════════╗\x1b[0m');
    console.log('\x1b[1m\x1b[33m║           EDBots Pairing                 ║\x1b[0m');
    console.log('\x1b[1m\x1b[33m╚══════════════════════════════════════════╝\x1b[0m');
    console.log('');
    console.log('No WhatsApp account is connected.');
    console.log('');
    console.log('Choose a connection method:');
    console.log('');
    console.log('  \x1b[1m[1]\x1b[0m QR Code');
    console.log('  \x1b[1m[2]\x1b[0m Pairing Code (phone number)');
    console.log('');
}

/**
 * Validate a WhatsApp phone number entered for pairing.
 * Returns cleaned digits or null if invalid.
 */
function cleanPhoneNumber(raw) {
    const cleaned = (raw || '').replace(/[^0-9]/g, '');
    if (!cleaned || cleaned.length < 8 || cleaned.length > 15) {
        return null;
    }
    return cleaned;
}

/**
 * Prompt until a valid phone number is provided.
 * EOF (piped input ending) exits with a clear message instead of hanging.
 */
async function promptForPhoneNumber() {
    // Small delay so pairing-instructions output is ordered after the prompt.
    for (;;) {
        const raw = await ask('Enter your WhatsApp phone number (e.g., 2348012345678): ');

        if (raw === null) {
            // stdin ended — never leave the user staring at a silent hang
            console.log('');
            logger.error('Input stream closed before a phone number was provided.');
            process.exit(1);
        }

        const cleaned = cleanPhoneNumber(raw);
        if (cleaned) return cleaned;

        logger.warn('Invalid phone number — use digits only, with country code.');
        logger.info('Example: 2348012345678 (Nigeria) or 14155552671 (US)');
    }
}

/**
 * Ask the user to choose an auth method. Resolves 'qr' or 'pair'.
 * No timer — waits indefinitely for a valid choice.
 */
async function selectAuthMethod() {
    // Non-TTY (piped input): read a line normally. EOF -> QR (safe default
    // for automated environments) instead of hanging forever.
    if (process.stdin.isTTY !== true) {
        logger.info('Non-interactive terminal detected — reading selection from input (EOF defaults to QR).');
        for (;;) {
            const raw = await ask('Select an option [1/2]: ');
            if (raw === null) {
                console.log('');
                logger.info('No selection made — defaulting to QR Code mode.');
                return 'qr';
            }
            const choice = raw.trim().toLowerCase();
            if (choice === '1' || choice === 'qr') {
                logger.success('QR Code selected');
                return 'qr';
            }
            if (choice === '2' || choice === 'pair' || choice === 'pairing') {
                logger.success('Pairing Code selected');
                return 'pair';
            }
            logger.warn(`Unknown option "${raw.trim()}". Please enter 1 or 2.`);
        }
    }

    // Interactive TTY: plain readline loop — waits as long as needed.
    printMenu();
    for (;;) {
        const raw = await ask('Select an option [1/2]: ');

        if (raw === null) {
            console.log('');
            logger.info('Input closed — defaulting to QR Code mode.');
            return 'qr';
        }

        const choice = raw.trim().toLowerCase();
        if (choice === '1' || choice === 'qr') {
            logger.success('QR Code selected');
            return 'qr';
        }
        if (choice === '2' || choice === 'pair' || choice === 'pairing') {
            logger.success('Pairing Code selected');
            return 'pair';
        }
        logger.warn(`Unknown option "${raw.trim()}". Please enter 1 or 2.`);
    }
}

/**
 * Full selection flow, returns { mode, phoneNumber }:
 *   { mode: 'qr' }   or   { mode: 'pair', phoneNumber: '2348012345678' }
 */
async function selectAuth() {
    const mode = await selectAuthMethod();
    if (mode === 'pair') {
        const phoneNumber = await promptForPhoneNumber();
        return { mode, phoneNumber };
    }
    return { mode };
}

/**
 * Map a selection to the env vars consumed by core/connection.js,
 * and close the prompt interface (a fresh one is created if ever
 * needed again — see prompts.js).
 */
function applyAuthEnv({ mode, phoneNumber }) {
    if (mode === 'pair') {
        process.env.EDBOTS_AUTH_MODE = 'pair';
        process.env.EDBOTS_PHONE_NUMBER = phoneNumber;
    } else {
        process.env.EDBOTS_AUTH_MODE = 'qr';
        delete process.env.EDBOTS_PHONE_NUMBER;
    }
    close();
}

module.exports = {
    selectAuth,
    selectAuthMethod,
    promptForPhoneNumber,
    cleanPhoneNumber,
    printMenu,
    applyAuthEnv,
};
