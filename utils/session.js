/**
 * @fileoverview This file contains the complete session and connection management for the Baileys WhatsApp bot.
 * It is designed to be production-ready, handling errors gracefully and providing clear, actionable logging.
 *
 * It implements a dual-mode authentication system:
 * 1. Environment Variable Mode (SESSION_ID): Recommended for production and stateless deployments (e.g., Docker, Railway, Render).
 *    The session is loaded from a Base64 encoded string provided in the environment.
 * 2. File System Mode: Recommended for local development. The session is saved locally in the `./auth_info` folder.
 *
 * Key Features:
 * - Automatic folder creation for authentication files.
 * - Robust reconnect logic that prevents infinite loops for terminal errors (e.g., logged out).
 * - Clear, step-by-step console logs to guide the user.
 * - Automatic session export when a new session is created in File System mode.
 */

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs =require('fs');
const path = require('path');
const handler = require('../handler'); // Assumes handler.js is in the root directory

// Define the directory path for storing authentication files.
const AUTH_DIR = path.join(__dirname, '..', 'auth_info');

/**
 * Initializes and starts the WhatsApp bot.
 * This is the main function that orchestrates the entire setup process.
 */
async function initializeBot() {
    // --- Step 1: Set up authentication ---
    // Ensure the authentication directory exists.
    if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
        console.log(`[SYSTEM] Created authentication directory at: ${AUTH_DIR}`);
    }

    // Determine auth mode and prepare session files if needed.
    const sessionID = process.env.SESSION_ID;
    if (sessionID) {
        console.log('[AUTH] Found SESSION_ID. Running in Environment Variable mode.');
        try {
            // Decode the Base64 session string and write it to creds.json
            const decodedSession = Buffer.from(sessionID, 'base64').toString('utf8');
            const credsPath = path.join(AUTH_DIR, 'creds.json');
            fs.writeFileSync(credsPath, decodedSession, 'utf8');
            console.log('[AUTH] ✅ Successfully imported session from SESSION_ID.');
        } catch (error) {
            console.error(`[AUTH] ❌ Fatal Error: Failed to decode or write SESSION_ID. The string may be corrupt. Details: ${error.message}`);
            process.exit(1); // Exit if the provided session is invalid.
        }
    } else {
        console.log('[AUTH] No SESSION_ID found. Running in File System mode.');
        console.log('[AUTH] Session files will be saved in the ./auth_info directory.');
    }

    // `useMultiFileAuthState` will now load the session from `auth_info`
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    // --- Step 2: Create the Socket ---
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }), // Suppress noisy logs
        printQRInTerminal: false, // We'll handle QR display manually for better instructions
        browser: Browsers.macOS('Desktop'),
        auth: state,
    });

    // --- Step 3: Register Event Handlers ---

    // Save credentials whenever they are updated
    sock.ev.on('creds.update', saveCreds);

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('
================================================');
            console.log('    ❗️ ACTION REQUIRED: SCAN QR CODE TO LOG IN     ');
            console.log('================================================
');
            const qrcode = require('qrcode-terminal');
            qrcode.generate(qr, { small: true });
            console.log('
[INSTRUCTION] Scan the QR code with your WhatsApp app.');
            console.log('[TIP] To run on a server, this is how you generate your first SESSION_ID.\n');
        }

        if (connection === 'open') {
            console.log('
================================================');
            console.log('           ✅ BOT CONNECTED SUCCESSFULLY           ');
            console.log('================================================
');
            console.log(`- Bot User: ${sock.user?.id || 'Unknown'}`);
            console.log(`- Bot Name: ${process.env.BOT_NAME || 'EDBOT V3'}\n`);

            // If we are in file-system mode, this is the moment to export the session
            if (!sessionID) {
                console.log('--------------------------------------------------------------------------------');
                console.log('🔑 NEW SESSION ID FOR PRODUCTION 🔑\n');
                console.log('To run this bot on a server (Railway, Render, Docker), copy the entire');
                console.log('string below and set it as the SESSION_ID environment variable.\n');

                try {
                    const credsData = fs.readFileSync(path.join(AUTH_DIR, 'creds.json'), 'utf8');
                    const base64Session = Buffer.from(credsData).toString('base64');
                    console.log('--- BEGIN SESSION ID ---');
                    console.log(base64Session);
                    console.log('---  END SESSION ID  ---');
                } catch (error) {
                    console.log("Could not export session. Please ensure 'creds.json' is generated correctly.");
                }
                console.log('
--------------------------------------------------------------------------------');
            }
        }

        if (connection === 'close') {
            // This is the critical part for fixing the reconnect loop and TypeError.
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            let shouldReconnect = true;
            let logMessage = `🔌 Connection closed.`;

            // *** FIX for "TypeError: DisconnectReason is not a constructor" ***
            // We directly compare the statusCode with the enum values from DisconnectReason.
            if (statusCode) {
                switch (statusCode) {
                    case DisconnectReason.loggedOut:
                        logMessage = '❌ Logged Out. Session is invalid. Please delete auth_info and restart.';
                        shouldReconnect = false; // Terminal error, do not reconnect.
                        break;
                    case 405: // Using the raw status code for Connection Replaced
                    case DisconnectReason.connectionReplaced:
                        logMessage = '🔄 Connection Replaced. Another session was opened elsewhere.';
                        shouldReconnect = false; // Terminal error for this instance.
                        break;
                    case DisconnectReason.restartRequired:
                        logMessage = '🔄 Server requires a restart. Reconnecting...';
                        break;
                    case DisconnectReason.timedOut:
                        logMessage = '⌛ Connection timed out. Reconnecting...';
						break;
                    default:
                        logMessage = `🔌 Connection closed with unhandled code: ${statusCode}. Reconnecting...`;
                        break;
                }
            } else {
                  logMessage += ' Reconnecting...';
            }


            console.log(logMessage);

            if (shouldReconnect) {
                setTimeout(() => initializeBot().catch(console.error), 5000);
            } else {
                console.log('[SYSTEM] Auto-reconnect disabled. Exiting.');
                // In a container, this exit will trigger a restart policy if configured.
                // In a local shell, it prevents a loop of failed connections.
                process.exit(1);
            }
        }
    });

    // Handle incoming messages
    sock.ev.on('messages.upsert', (m) => {
        if (m.messages && m.messages[0]) {
            // Pass the socket and the message to the main handler
            handler.handleMessage(sock, m.messages[0]).catch(err => {
                console.error(`[HANDLER_ERROR] ${err.message}`);
            });
        }
    });
     sock.ev.on('group-participants.update', async (update) => {
      await handler.handleGroupUpdate(sock, update);
    });
}

module.exports = { initializeBot };
