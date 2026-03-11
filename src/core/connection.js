/**
 * Baileys Connection Manager
 * Handles authentication, reconnection, and event registration
 */

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const config = require('../../config');
const logger = require('../utils/logger');

class ConnectionManager {
    constructor() {
        this.sock = null;
        this.sessionDir = path.resolve(__dirname, '../../' + (config.sessionName || 'session'));
    }

    async connect() {
        logger.info('Initializing Baileys connection...');

        if (!fs.existsSync(this.sessionDir)) {
            fs.mkdirSync(this.sessionDir, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
        const { version, isLatest } = await fetchLatestBaileysVersion();

        logger.info(`Using WhatsApp Web v${version.join('.')} (Latest: ${isLatest})`);

        this.sock = makeWASocket({
            version,
            logger: logger.child({ module: 'baileys' }, { level: 'silent' }),
            printQRInTerminal: true,
            browser: Browsers.ubuntu('Chrome'),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger.child({ module: 'signal' }, { level: 'silent' })),
            },
            generateHighQualityLinkPreview: true,
            markOnlineOnConnect: true,
            // Reconnection strategy
            retryRequestDelayMs: 2000,
        });

        // Event listeners
        this.sock.ev.on('creds.update', saveCreds);

        return this.sock;
    }

    handleDisconnection(lastDisconnect, reconnectCallback) {
        const statusCode = (lastDisconnect?.error instanceof Boom)
            ? lastDisconnect.error.output?.statusCode
            : null;

        const reason = lastDisconnect?.error?.message || 'Unknown Reason';
        logger.warn(`Connection closed. Status: ${statusCode}, Reason: ${reason}`);

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
            logger.info('Attempting to reconnect in 5 seconds...');
            setTimeout(reconnectCallback, 5000);
        } else {
            logger.error('CRITICAL: Logged out of WhatsApp. Session data may be invalid.');
            logger.error('Please delete the session folder and restart the bot.');
            process.exit(1);
        }
    }
}

module.exports = new ConnectionManager();
