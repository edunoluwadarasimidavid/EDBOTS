/**
 * EDBOTS - Core Startup & Connection Logic
 * Optimized for Baileys v6+ and Node.js 18+
 */

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { handleMessage, handleGroupUpdate, initializeAntiCall } = require('./handler');
const { checkRestartFlag } = require('./utils/restartManager');

/**
 * Main function to initialize and start the WhatsApp bot
 */
async function startBot() {
    console.log('[SYSTEM] Initializing EDBOTS...');
    
    const sessionDir = path.resolve(__dirname, './session');
    const credsPath = path.join(sessionDir, 'creds.json');
    const sessionKeyPath = path.join(sessionDir, 'session_key.js');

    // Ensure session directory exists
    if (!fs.existsSync(sessionDir)) {
        try {
            fs.mkdirSync(sessionDir, { recursive: true });
            console.log('[SYSTEM] Created session directory');
        } catch (err) {
            console.error('[CRITICAL] Failed to create session directory:', err.message);
            process.exit(1);
        }
    }

    // --- SESSION IMPORT LOGIC ---
    // Handles environment-based or file-based session keys for cloud deployments
    if (!fs.existsSync(credsPath)) {
        let sessionID = process.env.SESSION_ID;

        // Try to load from session_key.js if not in env
        if (!sessionID && fs.existsSync(sessionKeyPath)) {
            try {
                // Remove cache to ensure fresh read
                delete require.cache[require.resolve(sessionKeyPath)];
                const imported = require(sessionKeyPath);
                sessionID = typeof imported === 'string' ? imported : (imported.sessionID || imported.key);
            } catch (e) {
                console.warn('[AUTH] Warning: Error reading session_key.js:', e.message);
            }
        }

        if (sessionID && sessionID.trim() !== '') {
            try {
                console.log('[AUTH] Importing session from Session Key...');
                // Clean the ID (remove prefixes like 'EDBOTS!')
                const cleanID = sessionID.includes('!') ? sessionID.split('!')[1] : sessionID;
                const decoded = Buffer.from(cleanID, 'base64').toString('utf8');
                
                // Validate JSON before writing
                JSON.parse(decoded); 
                fs.writeFileSync(credsPath, decoded, 'utf8');
                console.log('[AUTH] ✓ Session imported successfully to creds.json');
            } catch (err) {
                console.error('[AUTH] ✗ Failed to decode Session Key:', err.message);
            }
        }
    }
    // ----------------------------

    // Load authentication state
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    
    // Fetch latest WhatsApp Web version to avoid "Old Version" errors
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[SYSTEM] Using Baileys v${version.join('.')} (Latest: ${isLatest})`);

    // Initialize Socket connection
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }), // Set to 'debug' or 'trace' if you encounter connection issues
        printQRInTerminal: false, // Pairing code is preferred for EDBOTS
        browser: Browsers.ubuntu('Chrome'),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: true,
    });

    // Initialize Anti-Call system
    initializeAntiCall(sock);

    // Support for Phone Number Pairing
    if (!sock.authState.creds.registered) {
        // Use the first owner number from config for pairing
        const phoneNumber = config.owner && config.owner[0] ? config.owner[0].replace(/[^0-9]/g, '') : null;
        
        if (phoneNumber) {
            console.log(`[AUTH] Generating pairing code for: ${phoneNumber}`);
            // Small delay to ensure socket is ready
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(phoneNumber);
                    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
                    console.log(`║  PAIRING CODE: ${code.match(/.{1,4}/g).join('-')}                          ║`);
                    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
                } catch (error) {
                    console.error('[AUTH] Error requesting pairing code:', error.message);
                }
            }, 3000);
        } else {
            console.warn('[AUTH] ALERT: No owner phone number found in config.js for pairing.');
            console.warn('[AUTH] ACTION: Add your number (with country code) to the owner array in config.js');
        }
    }

    // Save credentials whenever they are updated (essential for multi-file auth)
    sock.ev.on('creds.update', saveCreds);

    // Handle Connection Updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'open') {
            console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
            console.log(`║  ✅ BOT CONNECTED SUCCESSFULLY                               ║`);
            console.log(`║  User: ${sock.user?.name || 'EDBOTS'} (${sock.user?.id.split(':')[0]})           ║`);
            console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
            
            // Check if we just restarted from an update or manual command
            try {
                await checkRestartFlag(sock);
            } catch (err) {
                console.error('[SYSTEM] Error in checkRestartFlag:', err.message);
            }
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error instanceof Boom) 
                ? lastDisconnect.error.output?.statusCode 
                : null;
            
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(`[SYSTEM] Connection closed. Reason: ${lastDisconnect?.error?.message || 'Unknown'}`);
            
            if (shouldReconnect) {
                console.log('[SYSTEM] Attempting to reconnect...');
                // Exponential backoff or simple delay can be added here
                setTimeout(() => startBot(), 5000);
            } else {
                console.error('[SYSTEM] Critical: Logged out. Manual intervention required.');
                console.log('[SYSTEM] Recommendation: Delete the session folder and restart.');
                process.exit(1);
            }
        }
        
        // Log QR code if it appears (though pairing code is primary)
        if (qr) {
            console.log('[AUTH] QR Code generated. Scan it if not using pairing code.');
        }
    });

    // Handle Incoming Messages
    sock.ev.on('messages.upsert', async (m) => {
        try {
            if (m.type === 'notify' && m.messages && m.messages[0]) {
                const msg = m.messages[0];
                if (msg.key.remoteJid === 'status@broadcast') return; // Ignore status updates
                
                await handleMessage(sock, msg);
            }
        } catch (err) {
            console.error('[HANDLER] Error processing message:', err);
        }
    });

    // Handle Group Participant Updates (Welcome/Goodbye)
    sock.ev.on('group-participants.update', async (update) => {
        try {
            await handleGroupUpdate(sock, update);
        } catch (err) {
            console.error('[HANDLER] Error in group update handler:', err);
        }
    });

    // Handle Socket Errors
    sock.ev.on('error', (err) => {
        console.error('[SOCKET] Socket Error:', err);
    });

    return sock;
}

/**
 * Proactive Error Handling for Process-level Issues
 */
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err.message);
    console.error(err.stack);
    // Optional: Auto-restart on critical error
    // process.exit(1); 
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
});

// Start the bot
startBot().catch(err => {
    console.error('[SYSTEM] Failed to start bot:', err);
});
