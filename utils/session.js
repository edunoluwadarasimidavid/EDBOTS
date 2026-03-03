/**
 * Complete session and connection management for Baileys WhatsApp bot
 * Production-safe lifecycle manager
 */

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const fs = require('fs');
const path = require('path');
const handler = require('../handler');

const AUTH_DIR = path.join(__dirname, '..', 'session');

/* ===============================
   GLOBAL RUNTIME CONTROLS
================================ */

let isInitializing = false;
let activeSocket = null;
let reconnectTimer = null;
const INSTANCE_LOCK = path.join(AUTH_DIR, '.instance.lock');
let envSessionFailed = false;

/* ===============================
   UTILITIES
================================ */

function clearAuthFolder() {
    try {
        if (fs.existsSync(AUTH_DIR)) {
            // Instead of deleting the whole directory, we delete files inside it
            // except the .instance.lock if needed
            const files = fs.readdirSync(AUTH_DIR);
            for (const file of files) {
                if (file !== '.instance.lock') {
                    fs.rmSync(path.join(AUTH_DIR, file), { recursive: true, force: true });
                }
            }
            console.log('[AUTH] ✓ Session cleared.');
        }
    } catch (err) {
        console.error('[AUTH] ✗ Failed to clear session:', err.message);
    }
}

function createInstanceLock() {
    if (fs.existsSync(INSTANCE_LOCK)) {
        console.log('[GUARD] ✗ Another bot instance is already running.');
        // If we're sure it's the same process or an old lock, we could remove it, 
        // but for safety let's exit.
        process.exit(1);
    }
    fs.writeFileSync(INSTANCE_LOCK, String(process.pid));
}

function removeInstanceLock() {
    if (fs.existsSync(INSTANCE_LOCK)) {
        try {
            fs.unlinkSync(INSTANCE_LOCK);
        } catch {}
    }
}

function resetState() {
    isInitializing = false;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    activeSocket = null;
    console.log('[SYSTEM] ✓ State reset complete.');
}

function scheduleReconnect(delayMs = 5000) {
    if (reconnectTimer) return;
    console.log(`[SYSTEM] ⏱ Reconnecting in ${delayMs/1000}s...`);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        initializeBot().catch(console.error);
    }, delayMs);
}

function printFooter() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  EDBOT V3 - WhatsApp Bot                                     ║
║  Status: ${activeSocket?.user?.id ? 'CONNECTED' : 'DISCONNECTED'}                          ║
║  Session: ${process.env.SESSION_ID ? 'ENV' : 'FILE'} mode                                    ║
╚══════════════════════════════════════════════════════════════╝
`);
}

/* ===============================
   MAIN INITIALIZER
================================ */

async function initializeBot() {
    if (isInitializing) {
        console.log('[LOCK] ✗ Initialization already running.');
        return;
    }
    isInitializing = true;

    try {
        // CRITICAL: Create auth folder FIRST
        if (!fs.existsSync(AUTH_DIR)) {
            fs.mkdirSync(AUTH_DIR, { recursive: true });
            console.log('[SYSTEM] ✓ Created auth directory:', AUTH_DIR);
        }

        createInstanceLock();

        const sessionID = process.env.SESSION_ID;
        const credsPath = path.join(AUTH_DIR, 'creds.json');
        
        let useQR = false;

        // SESSION HANDLING LOGIC
        if (sessionID && !envSessionFailed) {
            console.log('[AUTH] → Found SESSION_ID in environment');
            try {
                // Strip any prefix before '!' (e.g. 'KnightBot!', 'EDBOTS!')
                const cleanSessionID = sessionID.includes('!') ? sessionID.split('!')[1] : sessionID;
                const decoded = Buffer.from(cleanSessionID, 'base64').toString('utf8');
                
                // Validate if it's a proper JSON
                JSON.parse(decoded);
                
                // Save it to creds.json to ensure persistence and support both
                fs.writeFileSync(credsPath, decoded, 'utf8');
                console.log('[AUTH] ✓ SESSION_ID decoded and saved to creds.json');
            } catch (err) {
                console.error('[AUTH] ✗ SESSION_ID invalid or decoding failed:', err.message);
                envSessionFailed = true;
            }
        }

        // Check if creds.json exists and is NOT empty (greater than 10 bytes to be safe for JSON)
        const hasCredsFile = fs.existsSync(credsPath) && fs.statSync(credsPath).size > 10;

        // DEBUG INFO
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║  SESSION DEBUG INFO                                          ║
╠══════════════════════════════════════════════════════════════╣
║  ENV SESSION_ID present: ${!!sessionID && !envSessionFailed ? 'YES ✓' : 'NO ✗'}                          ║
║  creds.json valid:       ${hasCredsFile ? 'YES ✓' : 'NO ✗'}                          ║
║  AUTH_DIR exists:        ${fs.existsSync(AUTH_DIR) ? 'YES ✓' : 'NO ✗'}                          ║
║  AUTH_DIR path:          ${AUTH_DIR}    ║
╚══════════════════════════════════════════════════════════════╝
`);

        if (hasCredsFile) {
            console.log('[AUTH] → Using creds.json for authentication');
        } else {
            console.log('[AUTH] → No valid session found, QR code login required');
            useQR = true;
        }

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

        const sock = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: useQR,
            browser: Browsers.macOS('Desktop'),
            auth: state,
        });

        activeSocket = sock;
        sock.ev.on('creds.update', saveCreds);

        /* ===============================
           CONNECTION EVENTS
        ============================== */

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && useQR) {
                console.log(`
╔══════════════════════════════════════════════════════════════╗
║  SCAN QR CODE WITH WHATSAPP                                  ║
╚══════════════════════════════════════════════════════════════╝
`);
                require('qrcode-terminal').generate(qr, { small: true });
            }

            if (connection === 'open') {
                console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ✅ BOT CONNECTED SUCCESSFULLY                               ║
║  User: ${sock.user?.id || 'unknown'}                                       ║
║  Time: ${new Date().toLocaleString()}                              ║
╚══════════════════════════════════════════════════════════════╝
`);
                isInitializing = false;
                printFooter();
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const reason = lastDisconnect?.error?.message || 'unknown';
                
                console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ❌ CONNECTION CLOSED                                        ║
║  Code: ${statusCode} | Reason: ${reason.substring(0, 30)}...             ║
╚══════════════════════════════════════════════════════════════╝
`);

                removeInstanceLock();
                resetState();

                // INVALID SESSION
                if (
                    statusCode === DisconnectReason.loggedOut ||
                    statusCode === DisconnectReason.connectionReplaced ||
                    statusCode === 405 ||
                    statusCode === 401
                ) {
                    console.log('[AUTH] Session invalid - clearing...');
                    
                    if (!hasCredsFile && sessionID) {
                        envSessionFailed = true;
                        console.log('[AUTH] Env SESSION_ID marked as failed');
                    }
                    
                    clearAuthFolder();
                    scheduleReconnect(3000);
                    return;
                }

                scheduleReconnect();
            }
        });

        sock.ev.on('messages.upsert', (m) => {
            if (m.messages?.[0]) {
                handler.handleMessage(sock, m.messages[0])
                    .catch(err => console.error('[HANDLER_ERROR]', err.message));
            }
        });

        sock.ev.on('group-participants.update', async (update) => {
            await handler.handleGroupUpdate(sock, update);
        });

    } catch (err) {
        console.error('[FATAL]', err.message);
        removeInstanceLock();
        resetState();
        scheduleReconnect();
    }
}

/* ===============================
   CLEAN SHUTDOWN
================================ */

process.on('SIGINT', () => {
    console.log('\n[SYSTEM] Shutting down gracefully...');
    removeInstanceLock();
    process.exit(0);
});

process.on('SIGTERM', () => {
    removeInstanceLock();
    process.exit(0);
});

// START
console.log(`
╔══════════════════════════════════════════════════════════════╗
║  🚀 STARTING EDBOT V3                                                   ║
╚══════════════════════════════════════════════════════════════╝
`);

module.exports = { initializeBot };
