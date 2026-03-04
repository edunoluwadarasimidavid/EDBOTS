const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { handleMessage, handleGroupUpdate, initializeAntiCall } = require('./handler');

async function startBot() {
    const sessionDir = './session';
    const credsPath = path.join(sessionDir, 'creds.json');
    const sessionKeyPath = path.join(sessionDir, 'session_key.js');

    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir);
    }

    // --- SESSION IMPORT LOGIC ---
    // If creds.json doesn't exist, try to import from Session Key
    if (!fs.existsSync(credsPath)) {
        let sessionID = process.env.SESSION_ID;

        // Try to load from session_key.js if not in env
        if (!sessionID && fs.existsSync(sessionKeyPath)) {
            try {
                const imported = require(sessionKeyPath);
                sessionID = typeof imported === 'string' ? imported : (imported.sessionID || imported.key);
            } catch (e) {
                console.warn('[AUTH] Error reading session_key.js:', e.message);
            }
        }

        if (sessionID && sessionID.trim() !== '') {
            try {
                console.log('[AUTH] Importing session from Session Key...');
                // Clean the ID (remove prefixes like 'EDBOTS!')
                const cleanID = sessionID.includes('!') ? sessionID.split('!')[1] : sessionID;
                const decoded = Buffer.from(cleanID, 'base64').toString('utf8');
                
                // Validate JSON and write creds.json
                JSON.parse(decoded); 
                fs.writeFileSync(credsPath, decoded, 'utf8');
                console.log('[AUTH] ✓ Session imported successfully to creds.json');
            } catch (err) {
                console.error('[AUTH] ✗ Failed to decode Session Key:', err.message);
            }
        }
    }
    // ----------------------------

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`[SYSTEM] Starting Bot with Baileys v${version.join('.')} (Latest: ${isLatest})`);

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Explicitly disabled as per user instruction
        browser: Browsers.ubuntu('Chrome'),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
    });

    // Initialize Anti-Call
    initializeAntiCall(sock);

    // Support for Phone Number Pairing
    if (!sock.authState.creds.registered) {
        // Use the first owner number from config for pairing if available, 
        // otherwise let the user know they need to configure it.
        const phoneNumber = config.owner?.[0]?.replace(/[^0-9]/g, '');
        
        if (phoneNumber) {
            console.log(`[AUTH] Generating pairing code for: ${phoneNumber}`);
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(phoneNumber);
                    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
                    console.log(`║  PAIRING CODE: ${code.match(/.{1,4}/g).join('-')}                          ║`);
                    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
                } catch (error) {
                    console.error('[AUTH] Failed to request pairing code:', error.message);
                }
            }, 3000);
        } else {
            console.warn('[AUTH] No owner phone number found in config.js for pairing.');
            console.warn('[AUTH] Please add your number to the owner array in config.js');
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
            console.log(`║  ✅ BOT CONNECTED SUCCESSFULLY                               ║`);
            console.log(`║  User: ${sock.user?.id.split(':')[0]}                                     ║`);
            console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom) 
                ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut 
                : true;

            console.log('[SYSTEM] Connection closed. Reason:', lastDisconnect?.error?.message || 'Unknown');
            
            if (shouldReconnect) {
                console.log('[SYSTEM] Reconnecting...');
                startBot();
            } else {
                console.log('[SYSTEM] Logged out. Please clear the session folder and restart.');
                process.exit(0);
            }
        }
    });

    // Handle incoming messages
    sock.ev.on('messages.upsert', async (m) => {
        if (m.messages?.[0]) {
            await handleMessage(sock, m.messages[0]);
        }
    });

    // Handle group updates
    sock.ev.on('group-participants.update', async (update) => {
        await handleGroupUpdate(sock, update);
    });

    return sock;
}

// Global error handling to prevent crashes
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

startBot();
