/**
 * @file connection.js
 * @description Hardened WhatsApp connection engine with auto-repair and session safety.
 */

const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');
const qrcode = require('qrcode-terminal');
const config = require('../config');
const { loadCommands } = require('../utils/commandLoader');
const { handleMessage } = require('./handler');
const { selfRepair } = require('../utils/selfRepair');
const { handleAuthFailure, safeWriteAuth } = require('../utils/sessionManager');

// Global state
let sock = null;
let reconnectAttempts = 0;
let commands = new Map();

// Logger setup
const logger = pino({ level: 'silent' });

// Session path
const SESSION_DIR = path.join(__dirname, '..', config.sessionName || 'session');

/**
 * Interactive Question Helper
 */
const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(text, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
};

/**
 * Main Connection Function
 */
const connectToWhatsApp = async () => {
    // 1. Run Self-Repair on startup
    selfRepair();

    // 2. Ensure session directory exists
    await fs.ensureDir(SESSION_DIR);

    // 3. Load Auth State
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    console.log(`\x1b[36m[SYSTEM] Using Baileys v${version.join('.')} (Latest: ${isLatest})\x1b[0m`);

    // 4. Load Commands once
    if (commands.size === 0) {
        commands = loadCommands();
    }

    // 5. Auth Preference (Pairing vs QR)
    let usePairingCode = false;
    let phoneNumber = "";

    if (!state.creds.me && !state.creds.registered) {
        if (process.stdin.isTTY) {
            console.log('\n\x1b[1m\x1b[33mSelect Authentication Method:\x1b[0m');
            console.log('1. QR Code (Default)');
            console.log('2. Pairing Code (Phone Number)');
            
            const choice = await question('Enter choice [1/2]: ');
            
            if (choice === '2') {
                usePairingCode = true;
                phoneNumber = await question('Enter your phone number (e.g., 2348012345678): ');
                phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
                
                if (!phoneNumber) {
                    console.log('\x1b[31m[ERROR] Invalid phone number. Defaulting to QR Code.\x1b[0m');
                    usePairingCode = false;
                }
            }
        }
    }

    // 6. Socket Configuration
    sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        retryRequestDelayMs: 2000,
    });

    // 7. Pairing Code Logic
    if (usePairingCode && !sock.authState.creds.registered) {
        try {
            console.log(`\x1b[33m[AUTH] Requesting pairing code for ${phoneNumber}...\x1b[0m`);
            await delay(5000); 
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n\x1b[1m\x1b[32mPAIRING CODE: ${code?.match(/.{1,4}/g)?.join('-') || code}\x1b[0m\n`);
        } catch (err) {
            console.error('\x1b[31m[AUTH] Failed to request pairing code:\x1b[0m', err.message);
        }
    }

    // 8. Connection Logic
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !usePairingCode) {
            console.log('\x1b[36m[AUTH] Scan the QR Code below:\x1b[0m');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const error = lastDisconnect?.error;
            
            // Call refined auth failure logic
            const isCleaned = await handleAuthFailure(error, SESSION_DIR);

            if (isCleaned) {
                console.log('\x1b[31m[CONNECTION] Re-launching to start fresh pairing...\x1b[0m');
                // Use a short delay before restarting to ensure filesystem is free
                setTimeout(() => connectToWhatsApp(), 2000);
            } else {
                const retryDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                console.log(`\x1b[33m[CONNECTION] Closed. Reconnecting in ${retryDelay/1000}s...\x1b[0m`);
                await delay(retryDelay);
                reconnectAttempts++;
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('\n\x1b[1m\x1b[32m[SUCCESS] EDBOT AI Connected Successfully!\x1b[0m');
            console.log(`\x1b[36m[INFO] User: ${sock.user.name || 'Bot'} (${sock.user.id.split(':')[0]})\x1b[0m\n`);
            reconnectAttempts = 0;
        }
    });

    // 9. Credential Saving - Patched for atomic safety
    sock.ev.on('creds.update', async () => {
        await safeWriteAuth(path.join(SESSION_DIR, 'creds.json'), sock.authState.creds);
    });

    // 10. Message Handling
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            if (!chatUpdate.messages || chatUpdate.messages.length === 0) return;
            const msg = chatUpdate.messages[0];
            if (!msg.message) return;
            if (msg.key.remoteJid === 'status@broadcast') return;

            await handleMessage(sock, msg, commands); 

        } catch (err) {
            console.error('\x1b[31m[HANDLER ERROR]\x1b[0m', err);
        }
    });

    return sock;
};

module.exports = { connectToWhatsApp };
