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

// Pairing-code state (reset per connection attempt)
let pairingRequested = false;
let pairingFailed = false;

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
 * Display the pairing code prominently
 */
const showPairingCode = (code) => {
    const formatted = (code || '').match(/.{1,4}/g)?.join('-') || code;
    console.log('\n');
    console.log('\x1b[1m\x1b[36m╔══════════════════════════════════════════╗\x1b[0m');
    console.log('\x1b[1m\x1b[36m║           EDBots Pairing Code            ║\x1b[0m');
    console.log('\x1b[1m\x1b[36m╚══════════════════════════════════════════╝\x1b[0m');
    console.log('');
    console.log(`\x1b[1m\x1b[32m         ${formatted}         \x1b[0m`);
    console.log('');
    console.log('\x1b[0mOpen WhatsApp → Linked Devices → Link with Phone Number');
    console.log('Enter the code above when prompted.\x1b[0m');
    console.log('');
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
    // The CLI (edbots start / edbots pair) sets EDBOTS_AUTH_MODE and skips
    // its own interactive prompt to avoid asking the user twice.
    // If the env var is not set (legacy `node index.js` run), fall back to the
    // interactive prompt on TTY, or QR mode on headless systems.
    let usePairingCode = false;
    let phoneNumber = "";

    const cliAuthMode = process.env.EDBOTS_AUTH_MODE || '';
    const cliAuthHandled = cliAuthMode === 'qr' || cliAuthMode === 'pair';

    if (cliAuthHandled) {
        // CLI already handled the selection — honor it silently
        if (cliAuthMode === 'pair') {
            usePairingCode = true;
            phoneNumber = (process.env.EDBOTS_PHONE_NUMBER || '').replace(/[^0-9]/g, '');
            if (!phoneNumber) {
                console.log('\x1b[31m[AUTH] CLI requested pairing mode but no phone number was set. Defaulting to QR Code.\x1b[0m');
                usePairingCode = false;
            }
        }
    } else if (!state.creds.me && !state.creds.registered) {
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

    // Reset per-attempt pairing state
    pairingRequested = false;
    pairingFailed = false;

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

    // 7. Connection Logic
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // ── Authentication ─────────────────────────────────────
        // The `qr` event fires only when the WebSocket is connected and
        // ready — this is the reliable moment to request a pairing code.
        // Requesting it earlier races against the socket handshake and
        // fails silently, which is why the code never showed before.
        if (qr) {
            if (usePairingCode && !pairingRequested) {
                pairingRequested = true;
                try {
                    console.log(`\x1b[33m[AUTH] Requesting pairing code for ${phoneNumber}...\x1b[0m`);
                    const code = await sock.requestPairingCode(phoneNumber);
                    showPairingCode(code);
                } catch (err) {
                    pairingFailed = true;
                    console.error('\x1b[31m[AUTH] Failed to request pairing code:\x1b[0m', err.message);
                    console.log('\x1b[33m[AUTH] Falling back to QR Code — scan below:\x1b[0m');
                    qrcode.generate(qr, { small: true });
                }
            } else if (!usePairingCode || pairingFailed) {
                console.log('\x1b[36m[AUTH] Scan the QR Code below (WhatsApp → Linked Devices):\x1b[0m');
                qrcode.generate(qr, { small: true });
            }
        }

        // ── Closed / reconnect ─────────────────────────────────
        if (connection === 'close') {
            const error = lastDisconnect?.error;
            
            // Call refined auth failure logic
            const isCleaned = await handleAuthFailure(error, SESSION_DIR);

            if (isCleaned) {
                console.log('\x1b[31m[CONNECTION] Re-launching to start fresh pairing...\x1b[0m');
                reconnectAttempts = 0;
                // Use a short delay before restarting to ensure filesystem is free
                setTimeout(() => connectToWhatsApp(), 2000);
            } else {
                reconnectAttempts++;
                // Give up after 10 failed attempts to avoid infinite loops
                if (reconnectAttempts > 10) {
                    console.error('\x1b[31m[CONNECTION] Too many reconnect attempts. Stopping.\x1b[0m');
                    console.log('\x1b[36m[CONNECTION] Try: edbots doctor  (or check your internet)\x1b[0m');
                    process.exit(1);
                }
                const retryDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                console.log(`\x1b[33m[CONNECTION] Closed. Reconnecting in ${retryDelay/1000}s... (attempt ${reconnectAttempts}/10)\x1b[0m`);
                await delay(retryDelay);
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('\n\x1b[1m\x1b[32m[SUCCESS] EDBots Connected Successfully!\x1b[0m');
            console.log(`\x1b[36m[INFO] User: ${sock.user.name || 'Bot'} (${sock.user.id.split(':')[0]})\x1b[0m\n`);
            reconnectAttempts = 0;
        }
    });

    // 8. Credential Saving - Patched for atomic safety
    sock.ev.on('creds.update', async () => {
        await safeWriteAuth(path.join(SESSION_DIR, 'creds.json'), sock.authState.creds);
    });

    // 9. Message Handling
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
