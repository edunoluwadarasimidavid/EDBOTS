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

// Control-layer bridge (additive): lets the REST API observe status and
// stop/start the bot without touching Baileys internals or message handling.
const botState = require('./botState');

// Auth state/event hub: publishes REAL Baileys events (QR, pairing code,
// connected, logged out) to the web pairing interface via SSE.
const authEvents = require('./authEvents');

// REST API control layer (additive). Starts once per process; failures are
// non-fatal so the bot always keeps working even if the API cannot bind.
let apiStarted = false;
function ensureApiServer() {
    if (apiStarted) return;
    apiStarted = true;
    try {
        const { start } = require('../api/server');
        start();
    } catch (err) {
        console.error('\x1b[31m[API] Failed to start REST API (bot continues):\x1b[0m', err.message);
    }
}

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
 * Headless web-pairing banner. The URL is auto-detected (config.js override,
 * platform env, or learned from the first browser request) — no env var
 * setup is required. LAN candidates are shown as extra options.
 */
const printWebPairingBanner = () => {
    let webPairConfig = null;
    try {
        webPairConfig = require('../api/webpair/config');
    } catch {
        webPairConfig = null;
    }

    console.log('\n');
    console.log('\x1b[1m\x1b[36m╭────────────────────────────────────────────╮\x1b[0m');
    console.log('\x1b[1m\x1b[36m│        EDBOTS Web Authentication           │\x1b[0m');
    console.log('\x1b[1m\x1b[36m╰────────────────────────────────────────────╯\x1b[0m');
    console.log('');

    const known = webPairConfig && webPairConfig.getBaseUrl();
    if (known) {
        const src = webPairConfig.publicUrlSource === 'config' ? 'from config.js'
            : webPairConfig.publicUrlSource === 'platform' ? `detected (${webPairConfig.platformVar})`
            : '';
        console.log(`\x1b[1m\x1b[32m  Open this URL in your browser:\x1b[0m`);
        console.log(`\x1b[1m\x1b[32m  ${known}/pair\x1b[0m`);
        if (src) console.log(`\x1b[2m  ${src}\x1b[0m`);
    } else {
        console.log('\x1b[36m  No interactive terminal — authentication moved to the browser.\x1b[0m');
        console.log('');
        const lanIp = webPairConfig && webPairConfig.primaryLanIp();
        const port = webPairConfig ? webPairConfig.port : 3000;
        if (lanIp) {
            console.log(`\x1b[1m\x1b[32m  On the same network, open:\x1b[0m`);
            console.log(`\x1b[1m\x1b[32m  http://${lanIp}:${port}/pair\x1b[0m`);
        } else {
            console.log(`\x1b[36m  Open http://<this-server>:${port}/pair\x1b[0m`);
        }
        console.log('');
        console.log('\x1b[2m  Behind a proxy/tunnel? The exact URL is learned from your first\x1b[0m');
        console.log('\x1b[2m  visit — open https://your-domain/pair and the page takes over.\x1b[0m');
    }
    console.log('');
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
    // Start the REST API control layer (once per process)
    ensureApiServer();

    // Report lifecycle to the control layer
    botState.setStatus('connecting');

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

    // Headless detection: no usable interactive stdin (cloud/VPS/Docker).
    // config.js webPairing.publicUrl also forces web pairing for servers
    // with a degraded TTY. .env is deliberately not involved here.
    let cfgWebPairing = {};
    try {
        cfgWebPairing = require('../config').webPairing || {};
    } catch {
        cfgWebPairing = {};
    }
    const headless = cfgWebPairing.publicUrl || !process.stdin.isTTY || !process.stdout.isTTY;

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
    } else if (headless && !state.creds.me && !state.creds.registered) {
        // Headless/cloud AND no usable session: the web pairing interface
        // owns first-time auth. QR arrives via the normal Baileys 'qr'
        // event and streams to the browser over SSE; pairing codes are
        // requested from the web UI. (With an existing session this branch
        // is skipped and the bot connects silently — no pairing URL.)
        authEvents.setState('WAITING_FOR_AUTH');
        printWebPairingBanner();

        // Create/refresh the pairing token (printed once to this console —
        // the owner pastes it into /pair to unlock the sensitive UI).
        try {
            const tokenStore = require('../api/webpair/tokenStore');
            const plaintext = tokenStore.ensure();
            if (plaintext) {
                console.log('');
                console.log('\x1b[33m  Pairing token (paste into the browser when asked):\x1b[0m');
                console.log(`\x1b[1m\x1b[32m  ${plaintext}\x1b[0m`);
                console.log('');
            }
        } catch (err) {
            console.log('\x1b[33m[AUTH] Pairing token unavailable:', (err && err.message) || err, '\x1b[0m');
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

        // Expose the live socket to the control layer (read-only consumers)
        botState.setSocket(sock);

        // ── Authentication ─────────────────────────────────────
        // The `qr` event fires only when the WebSocket is connected and
        // ready — this is the reliable moment to request a pairing code.
        // Requesting it earlier races against the socket handshake and
        // fails silently, which is why the code never showed before.
        if (qr) {
            // Publish every QR WhatsApp issues to the web UI (SSE). It is
            // rendered to a PNG data-URL — the raw QR string stays on the
            // server and never crosses the wire.
            authEvents.setQr(qr);

            // Web-initiated pairing: botState holds a number queued by the
            // browser. This qr event is the safe moment to call WhatsApp —
            // requesting earlier races the socket handshake and fails.
            const webNumber = botState.consumeWebPairingNumber();
            if (webNumber && !pairingRequested) {
                pairingRequested = true;
                try {
                    console.log(`\x1b[33m[AUTH] Web pairing: requesting pairing code for ${webNumber}...\x1b[0m`);
                    const code = await sock.requestPairingCode(webNumber);
                    authEvents.setPairingCode(code);
                    pairingFailed = false;
                } catch (err) {
                    pairingFailed = true;
                    console.error('\x1b[31m[AUTH] Web pairing code request failed:\x1b[0m', err && err.message ? err.message : err);
                    botState.setWebPairingError(err && err.message ? err.message : 'pairing failed');
                }
                return; // next qr event (or a fresh attempt) re-evaluates
            }

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
            } else if (headless) {
                // Web pairing owns the UI: the QR lives in the browser at
                // /pair (streamed via SSE). Never print it in this terminal.
                console.log('\x1b[36m[AUTH] QR code ready — open the Web Authentication URL above to scan it.\x1b[0m');
            } else if (!usePairingCode || pairingFailed) {
                console.log('\x1b[36m[AUTH] Scan the QR Code below (WhatsApp → Linked Devices):\x1b[0m');
                qrcode.generate(qr, { small: true });
            }
        }

        // ── Closed / reconnect ─────────────────────────────────
        if (connection === 'close') {
            const error = lastDisconnect?.error;

            // Report to the control layer
            botState.setStatus('offline', { reason: error?.message || 'connection_closed' });

            // Publish the close to the web pairing UI, classifying the reason:
            // loggedOut is permanent; everything else is a reconnectable drop
            // (the UI keeps showing "Connecting…" rather than a failure).
            const statusCode = new (require('@hapi/boom').Boom)(error)?.output?.statusCode;
            if (statusCode === 401) {
                authEvents.setState('LOGGED_OUT');
            } else if (reconnectAttempts === 0 && !botState.isStopped()) {
                // First close of this attempt cycle — surface as FAILED so the
                // user sees something went wrong; reconnection continues below.
                authEvents.setState('FAILED', { reason: (error && error.message) || 'connection_closed' });
            }

            // API-requested stop: do NOT reconnect (session stays intact)
            if (botState.isStopped()) {
                console.log('\x1b[33m[CONNECTION] Stopped via API. Reconnect suppressed.\x1b[0m');
                return;
            }

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

            // Report to the control layer
            botState.setStatus('online');

            // Auth complete: publish CONNECTED, which also clears any QR/
            // pairing code still on screen and lets tokenStore consume the
            // pairing token (done in webpair/routes on state change).
            authEvents.setState('CONNECTED');
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
