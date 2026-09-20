/**
 * @file qr.js
 * @description QR Code display utility for EDBots CLI.
 * Works on SSH, VPS, Docker, and standard terminals.
 */

const qrcode = require('qrcode-terminal');
const logger = require('./logger');

/**
 * Display a QR code for WhatsApp authentication
 */
function displayQR(qrData) {
    console.log('\n');
    logger.box('EDBots — QR Authentication', [
        '',
        'Scan this QR code with WhatsApp:',
        '',
    ]);
    
    try {
        qrcode.generate(qrData, { small: true }, (qr) => {
            console.log(qr);
            console.log('');
            logger.info('Open WhatsApp → Linked Devices → Link with Device');
            logger.info('Waiting for authentication...\n');
        });
    } catch (err) {
        // Fallback: try to display in terminal directly
        try {
            console.log(qrData);
            console.log('');
            logger.info('Scan the above QR code with WhatsApp');
        } catch (e) {
            logger.error('Could not display QR code');
            logger.info('QR data received but terminal does not support display');
        }
    }
}

/**
 * Display a pairing code
 */
function displayPairingCode(code) {
    const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
    
    console.log('\n');
    logger.box('EDBots — Pairing Code', [
        '',
        `Your pairing code: ${logger.COLORS.bold}${logger.COLORS.green}${formatted}${logger.COLORS.reset}`,
        '',
        'Open WhatsApp → Linked Devices → Link with Phone Number',
        'Enter the code above when prompted.',
        '',
    ]);
}

/**
 * Display auth success message
 */
function displayAuthSuccess(user) {
    logger.success('WhatsApp authentication successful');
    logger.success(`Connected as: ${user.name || 'Bot'} (${user.id || 'unknown'})`);
    logger.success('Session saved');
    logger.info('Starting EDBots...\n');
}

/**
 * Display auth failure message
 */
function displayAuthFailure(reason) {
    logger.error('WhatsApp authentication failed');
    logger.warn(`Reason: ${reason}`);
    logger.info('Try running: edbots pair');
}

module.exports = { displayQR, displayPairingCode, displayAuthSuccess, displayAuthFailure };
