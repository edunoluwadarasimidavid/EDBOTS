/**
 * @fileoverview This file contains the complete session and connection management for the Baileys WhatsApp bot.
 * It implements a dual-mode authentication system:
 * 1. Environment Variable Mode (SESSION_ID): Ideal for production and stateless deployments (Docker, Railway, Render).
 *    The session is loaded from a Base64 encoded string.
 * 2. File System Mode: Ideal for local development. The session is saved locally in the "./auth_info" folder.
 *
 * This system is designed to be robust, self-contained, and easy to configure. It prevents common issues
 * like infinite reconnect loops and provides clear instructions to the user.
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
const handler = require('../handler'); // Main message handler
const config = require('../config');   // Bot configuration

// Define the directory for storing authentication files.
const AUTH_DIR = path.join(__dirname, '..', 'auth_info');

/**
 * Encodes the authentication state to a Base64 string.
 * This is used to export the session for use in environment variables.
 * @returns {string | null} The Base64 encoded session string or null if an error occurs.
 */
function exportSession() {
    console.log('[SESSION] Exporting session to Base64 string...');
    try {
        const credsPath = path.join(AUTH_DIR, 'creds.json');
        if (!fs.existsSync(credsPath)) {
            console.error('[SESSION] Failed to export: creds.json not found.');
            return null;
        }
        const sessionData = fs.readFileSync(credsPath, 'utf8');
        const base64Session = Buffer.from(sessionData).toString('base64');
        console.log('[SESSION] ✅ Session exported successfully.');
        return base64Session;
    } catch (error) {
        console.error(`[SESSION] ❌ Error exporting session: ${error.message}`);
        return null;
    }
}

/**
 * Decodes a Base64 session string and writes it to `creds.json`.
 * This function enables the bot to be pre-authenticated using an environment variable,
 * which is essential for stateless hosting platforms.
 */
function importSession() {
    const sessionID = process.env.SESSION_ID;
    if (!sessionID) {
        // This is not an error, just a different startup mode.
        console.log('[SESSION] No SESSION_ID found in environment. Running in File System mode.');
        return;
    }

    console.log('[SESSION] Found SESSION_ID. Running in Environment Variable mode.');
    try {
        const decodedSession = Buffer.from(sessionID, 'base64').toString('utf8');
        const credsPath = path.join(AUTH_DIR, 'creds.json');
        fs.writeFileSync(credsPath, decodedSession, 'utf8');
        console.log('[SESSION] ✅ Successfully imported session and created creds.json.');
    } catch (error) {
        console.error(`[SESSION] ❌ Fatal Error: Failed to decode or write SESSION_ID. The provided string may be corrupt. Details: ${error.message}`);
        // This is a fatal error because the user intended to use a session, but it failed.
        process.exit(1);
    }
}

/**
 * Initializes and starts the WhatsApp bot.
 * This function orchestrates the entire setup process, including:
 * - Setting up the authentication mode (ENV or File).
 * - Creating the Baileys socket.
 * - Registering all necessary event handlers for connection logic, message handling, etc.
 */
async function initializeBot() {
    // Ensure the authentication directory exists before doing anything.
    if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
        console.log(`[SYSTEM] Created authentication directory at: ${AUTH_DIR}`);
    }

    // Load or create the session based on the presence of the SESSION_ID environment variable.
    importSession();

    // `useMultiFileAuthState` will now either load the session from the created `creds.json` (ENV mode)
    // or start a new session which will be saved in the `auth_info` folder (File mode).
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    const suppressedLogger = pino({ level: 'silent' });

    // Create the WhatsApp socket with the loaded authentication state.
    const sock = makeWASocket({
        logger: suppressedLogger,
        printQRInTerminal: false, // We will handle QR code logging manually for better instructions.
        browser: Browsers.macOS('Desktop'),
        auth: state,
        syncFullHistory: false, // Optional: for faster startup
        markOnlineOnConnect: false,
    });

    // Register event handler to save credentials whenever they are updated.
    sock.ev.on('creds.update', saveCreds);

    // ============================================ 
    // Connection Update Handler
    // ============================================ 
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // --- 1. Handle QR Code Display ---
        if (qr) {
            console.log('\n\n================================================');
            console.log('            SCAN QR TO START SESSION            ');
            console.log('================================================\n');
            const qrcode = require('qrcode-terminal');
            qrcode.generate(qr, { small: true });
            console.log('\n[INSTRUCTION] Scan the QR code above with your WhatsApp app.');
            console.log('[NOTE] If you want to run the bot on a server, this is when you generate your session.');
        }

        // --- 2. Handle Connection Open ---
        if (connection === 'open') {
            console.log('\n================================================');
            console.log('           ✅ BOT CONNECTED SUCCESSFULLY           ');
            console.log('================================================\n');
            console.log(`- Bot Number: ${sock.user.id.split(':')[0]}`);
            console.log(`- Bot Name: ${config.botName}`);
            console.log(`- Prefix: ${config.prefix}\n`);

            // If running in File System mode, export and display the session ID for the user.
            if (!process.env.SESSION_ID) {
                console.log('--------------------------------------------------------------------------------');
                console.log('🔑 YOUR SESSION ID (for Environment Variable mode) 🔑\n');
                console.log('Copy the following string and set it as the SESSION_ID environment variable');
                console.log('in your hosting environment (Railway, Render, Docker) to avoid scanning the QR again.\n');
                const sessionString = exportSession();
                if (sessionString) {
                    console.log('--- START ---');
                    console.log(sessionString);
                    console.log('---  END  ---');
                }
                console.log('\n--------------------------------------------------------------------------------');
            }
        }

        // --- 3. Handle Connection Close (with robust reconnect logic) ---
        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error)?.output?.statusCode;
            const reason = new DisconnectReason(statusCode);
            let shouldReconnect = true;
            let logMessage = `🔌 Connection closed. Reason: ${reason}.`;

            switch (statusCode) {
                case DisconnectReason.loggedOut:
                    logMessage = '❌ Connection logged out. The session is invalid. Please delete the auth_info folder and generate a new session by scanning the QR code.';
                    shouldReconnect = false; // Do not reconnect, session is gone.
                    break;
                case DisconnectReason.connectionReplaced:
                    logMessage = '🔄 Connection replaced. Another session was opened. Please close the other session to use this one.';
                    shouldReconnect = false; // Do not reconnect, let the user decide.
                    break;
                case DisconnectReason.restartRequired:
                    logMessage = '🔄 Server requires a restart. Reconnecting...';
                    break;
                case DisconnectReason.timedOut:
                    logMessage = '⌛ Connection timed out. Reconnecting...';
                    break;
                default:
                    logMessage = `🔌 Connection closed with unhandled status code: ${statusCode}. Reconnecting...`;
                    break;
            }

            console.log(logMessage);

            if (shouldReconnect) {
                // Use a small delay before attempting to reconnect.
                setTimeout(() => initializeBot().catch(console.error), 5000);
            } else {
                console.log('[SYSTEM] Auto-reconnect disabled for this reason. The bot will exit. Please resolve the issue and restart manually.');
                // In a containerized environment, the container should restart automatically.
                // In other environments, this prevents a resource-draining infinite loop.
                process.exit(1);
            }
        }
    });

    // ============================================ 
    // Message Handler
    // ============================================ 
    sock.ev.on('messages.upsert', (m) => {
        // Pass the socket and the message to the main handler.
        if (m.messages && m.messages[0]) {
            handler.handleMessage(sock, m.messages[0]).catch(err => {
                console.error(`❌ Error in message handler: ${err.message}`);
            });
        }
    });
    
    // Handle group participant updates (welcome/goodbye)
    sock.ev.on('group-participants.update', async (update) => {
      await handler.handleGroupUpdate(sock, update);
    });

    return sock;
}

module.exports = { initializeBot };