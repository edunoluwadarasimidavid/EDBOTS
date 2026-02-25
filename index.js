/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║                    EDBOT - WhatsApp MD Bot                    ║
 * ║                                                               ║
 * ║  Built by: Edun Oluwadarasimi David                           ║
 * ║  GitHub: https://github.com/edunoluwadarasimidavid            ║
 * ║  Instagram: @edunoluwadarasimidavid                           ║
 * ║                                                               ║
 * ║  A powerful WhatsApp bot built with Baileys library           ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

// ============================================
// CRITICAL: Environment Setup (MUST be first)
// ============================================
// Prevent Puppeteer/Chromium from auto-downloading
process.env.PUPPETEER_SKIP_DOWNLOAD = 'true';
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';
process.env.PUPPETEER_CACHE_DIR = process.env.PUPPETEER_CACHE_DIR || '/tmp/puppeteer_cache_disabled';

// ============================================
// Initialize Temp System (Before any libraries)
// ============================================
const { initializeTempSystem } = require('./utils/tempManager');
const { startCleanup } = require('./utils/cleanup');
initializeTempSystem();
startCleanup();

// ============================================
// Console Output Filtering
// Suppress noisy WhatsApp internal messages
// ============================================
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Patterns to hide from console (internal WhatsApp protocol messages)
const forbiddenPatternsConsole = [
  'closing session',
  'closing open session',
  'sessionentry',
  'prekey bundle',
  'pendingprekey',
  '_chains',
  'registrationid',
  'currentratchet',
  'chainkey',
  'ratchet',
  'signal protocol',
  'ephemeralkeypair',
  'indexinfo',
  'basekey'
];

// Override console methods to filter out noise
console.log = (...args) => {
  const message = args.map(a => typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
  if (!forbiddenPatternsConsole.some(pattern => message.includes(pattern))) {
    originalConsoleLog.apply(console, args);
  }
};

console.error = (...args) => {
  const message = args.map(a => typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
  if (!forbiddenPatternsConsole.some(pattern => message.includes(pattern))) {
    originalConsoleError.apply(console, args);
  }
};

console.warn = (...args) => {
  const message = args.map(a => typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
  if (!forbiddenPatternsConsole.some(pattern => message.includes(pattern))) {
    originalConsoleWarn.apply(console, args);
  }
};

// ============================================
// Import Required Libraries
// ============================================
const pino = require('pino');
const {
  default: makeWASocket,
  DisconnectReason,
  Browsers
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const config = require('./config');
const handler = require('./handler');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { initializeAuth, generateSessionString } = require('./utils/session');

/**
 * Remove Puppeteer cache to save disk space
 */
function cleanupPuppeteerCache() {
  try {
    const home = os.homedir();
    const cacheDir = path.join(home, '.cache', 'puppeteer');

    if (fs.existsSync(cacheDir)) {
      console.log('🧹 Removing Puppeteer cache at:', cacheDir);
      fs.rmSync(cacheDir, { recursive: true, force: true });
      console.log('✅ Puppeteer cache removed');
    }
  } catch (err) {
    console.error('⚠️ Failed to cleanup Puppeteer cache:', err.message || err);
  }
}

// ============================================
// In-Memory Message Store
// Lightweight storage for recent messages
// ============================================
const store = {
  messages: new Map(),
  maxPerChat: 20, // Maximum messages to keep per chat
  
  // Bind store to socket events
  bind: (ev) => {
    ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        if (!msg.key?.id) continue;
        
        const jid = msg.key.remoteJid;
        if (!store.messages.has(jid)) {
          store.messages.set(jid, new Map());
        }
        
        const chatMsgs = store.messages.get(jid);
        chatMsgs.set(msg.key.id, msg);
        
        // Remove oldest messages if limit exceeded
        if (chatMsgs.size > store.maxPerChat) {
          const oldestKey = chatMsgs.keys().next().value;
          chatMsgs.delete(oldestKey);
        }
      }
    });
  },
  
  // Load a specific message by JID and ID
  loadMessage: async (jid, id) => {
    return store.messages.get(jid)?.get(id) || null;
  }
};

// ============================================
// Message Deduplication
// Prevents processing the same message twice
// ============================================
const processedMessages = new Set();
setInterval(() => {
  processedMessages.clear();
}, 5 * 60 * 1000); // Clear every 5 minutes

/**
 * Create a suppressed Pino logger
 * Filters out internal WhatsApp protocol noise
 * @param {string} level - Log level
 * @returns {Object} Configured logger
 */
const createSuppressedLogger = (level = 'silent') => {
  const forbiddenPatterns = [
    'closing session',
    'closing open session',
    'sessionentry',
    'prekey bundle',
    'pendingprekey',
    '_chains',
    'registrationid',
    'currentratchet',
    'chainkey',
    'ratchet',
    'signal protocol',
    'ephemeralkeypair',
    'indexinfo',
    'basekey',
    'sessionentry',
    'ratchetkey'
  ];

  let logger;
  try {
    logger = pino({
      level,
      transport: process.env.NODE_ENV === 'production' ? undefined : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname'
        }
      },
      customLevels: {
        trace: 0,
        debug: 1,
        info: 2,
        warn: 3,
        error: 4,
        fatal: 5
      },
      redact: ['registrationId', 'ephemeralKeyPair', 'rootKey', 'chainKey', 'baseKey']
    });
  } catch (err) {
    logger = pino({ level });
  }

  const originalInfo = logger.info.bind(logger);
  logger.info = (...args) => {
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ').toLowerCase();
    if (!forbiddenPatterns.some(pattern => msg.includes(pattern))) {
      originalInfo(...args);
    }
  };
  logger.debug = () => {};
  logger.trace = () => {};
  return logger;
};

// ============================================
// Main Bot Function
// Initializes and manages the WhatsApp connection
// ============================================
async function startBot() {
  // --- Start of Refactored Session Logic ---
  // The new `initializeAuth` function from `utils/session.js` now handles all session logic.
  // 1. It ensures the session directory exists.
  // 2. It restores the session from the `SESSION_ID` env var if it exists.
  // 3. It calls `useMultiFileAuthState` to load or create the session.
  // This approach is production-safe, container-friendly, and fixes the crash.
  const { state, saveCreds } = await initializeAuth();
  // --- End of Refactored Session Logic ---
 
  const suppressedLogger = createSuppressedLogger('silent');
 
  // Create WhatsApp socket connection
  const sock = makeWASocket({
    logger: suppressedLogger,
    printQRInTerminal: false, // We handle QR manually
    browser: Browsers.macOS('Desktop'),
    auth: state,
    syncFullHistory: false,
    downloadHistory: false,
    markOnlineOnConnect: false,
    getMessage: async () => undefined
  });
 
  // Bind message store to socket
  store.bind(sock.ev);
 
  // ============================================
  // Watchdog: Reconnect on inactivity
  // ============================================
  let lastActivity = Date.now();
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  sock.ev.on('messages.upsert', () => {
    lastActivity = Date.now();
  });

  const watchdogInterval = setInterval(async () => {
    if (Date.now() - lastActivity > INACTIVITY_TIMEOUT && sock.ws.readyState === 1) {
      console.log('⚠️ No activity detected. Forcing reconnect...');
      await sock.end(new Error('Inactivity timeout'), { reason: 'inactive', isLogout: false });
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  sock.ev.on('connection.update', (update) => {
    const { connection } = update;
    if (connection === 'open') {
      lastActivity = Date.now();
    }
  });
 
  // ============================================
  // Connection Update Handler
  // Handles QR codes, connection open/close events
  // ============================================
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
   
    // Display QR code for scanning
    if (qr) {
      console.log('\n\n------------------------------------------------');
      console.log('📱 SCAN THIS QR CODE WITH WHATSAPP 📱');
      console.log('------------------------------------------------\n');
      qrcode.generate(qr, { small: true });
      console.log('\n[INFO] The QR code is valid for a short period. Scan it with your WhatsApp mobile app.');
    }
   
    // Handle connection close
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      let reason = "Unknown reason";

      if (statusCode) {
          switch (statusCode) {
              case DisconnectReason.connectionClosed:
                  reason = "Connection closed";
                  break;
              case DisconnectReason.connectionLost:
                  reason = "Connection lost";
                  break;
              case DisconnectReason.connectionReplaced:
                  reason = "Connection replaced";
                  break;
              case DisconnectReason.loggedOut:
                  reason = "Logged out";
                  console.error("❌ Device has been logged out. Please delete the session folder and restart.");
                  process.exit(1); // Exit because the session is invalid
              case DisconnectReason.restartRequired:
                  reason = "Restart required";
                  break;
              case DisconnectReason.timedOut:
                  reason = "Connection timed out";
                  break;
              default:
                  reason = `Unknown disconnect reason with status code: ${statusCode}`;
          }
      }
      
      console.log(`🔌 Connection closed. Reason: ${reason}. Reconnecting: ${shouldReconnect}`);
     
      if (shouldReconnect) {
        // Use a small delay before attempting to reconnect
        setTimeout(() => startBot(), 5000);
      }
    } 
    // Handle connection open
    else if (connection === 'open') {
      console.log('\n✅ Bot connected successfully!');
      console.log(`📱 Bot Number: ${sock.user.id.split(':')[0]}`);
      console.log(`🤖 Bot Name: ${config.botName}`);
      console.log(`⚡ Prefix: ${config.prefix}`);
      const ownerNames = Array.isArray(config.ownerName) ? config.ownerName.join(', ') : config.ownerName;
      console.log(`👑 Owner: ${ownerNames}\n`);
      console.log('Bot is ready to receive messages!\n');
      
      // --- Start of New Session ID Generation ---
      // This is a new feature to improve usability in production environments.
      // If the bot starts without a `SESSION_ID`, it means a new QR scan was needed.
      // After connecting, we generate the new session string and display it for the user.
      if (!process.env.SESSION_ID) {
        const sessionString = generateSessionString();
        if (sessionString) {
          console.log('================================================================================');
          console.log('🔑 NEW SESSION ID GENERATED 🔑');
          console.log('\nTo avoid scanning the QR code next time, copy the entire block below');
          console.log('and set it as the SESSION_ID environment variable in your deployment environment.');
          console.log('\n--- COPY FROM HERE ---');
          console.log(sessionString);
          console.log('--- TO HERE ---\n');
          console.log('================================================================================\n');
        }
      }
      // --- End of New Session ID Generation ---

      // Update bio if enabled
      if (config.autoBio) {
        await sock.updateProfileStatus(`${config.botName} | Active 24/7`);
      }
      
      // Initialize anti-call feature
      handler.initializeAntiCall(sock);
      
      // Cleanup old chat messages from the in-memory store
      const now = Date.now();
      for (const [jid, chatMsgs] of store.messages.entries()) {
        const timestamps = Array.from(chatMsgs.values()).map(m => (m.messageTimestamp || 0) * 1000);
        if (timestamps.length > 0 && (now - Math.max(...timestamps)) > 24 * 60 * 60 * 1000) {
          store.messages.delete(jid);
        }
      }
      console.log(`🧹 In-memory message store cleaned. Active chats: ${store.messages.size}`);
    }
  });
 
  // Save credentials when updated
  sock.ev.on('creds.update', saveCreds);
 
  /**
   * Check if JID is a system/broadcast JID
   * @param {string} jid - JID to check
   * @returns {boolean} True if system JID
   */
  const isSystemJid = (jid) => {
    if (!jid) return true;
    return jid.includes('@broadcast') ||
           jid.includes('status.broadcast') ||
           jid.includes('@newsletter') ||
           jid.includes('@newsletter.');
  };
 
  // ============================================
  // Message Handler
  // Processes incoming messages
  // ============================================
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;
   
    for (const msg of messages) {
      if (!msg.message || !msg.key?.id) continue;
     
      const from = msg.key.remoteJid;
     
      if (!from) continue;
     
      // Skip system messages
      if (isSystemJid(from)) continue;
     
      // Deduplication check
      const msgId = msg.key.id;
      if (processedMessages.has(msgId)) continue;
     
      // Skip old messages (older than 5 minutes) to prevent processing backlog on reconnect
      const MESSAGE_AGE_LIMIT = 5 * 60 * 1000;
      if (msg.messageTimestamp) {
        const messageAge = Date.now() - (msg.messageTimestamp * 1000);
        if (messageAge > MESSAGE_AGE_LIMIT) {
          console.log(`[MSG] Skipping old message from ${from} (age: ${Math.round(messageAge / 1000)}s)`);
          continue;
        }
      }
     
      processedMessages.add(msgId);
      
      // Store message in memory
      if (msg.key && msg.key.id) {
        if (!store.messages.has(from)) {
          store.messages.set(from, new Map());
        }
        const chatMsgs = store.messages.get(from);
        chatMsgs.set(msg.key.id, msg);
        
        // Keep only recent messages by timestamp
        if (chatMsgs.size > store.maxPerChat) {
          const sortedEntries = Array.from(chatMsgs.entries())
            .sort((a, b) => (a[1].messageTimestamp || 0) - (b[1].messageTimestamp || 0));
          
          // Delete the oldest entries until the size is correct
          for (let i = 0; i < sortedEntries.length - store.maxPerChat; i++) {
            chatMsgs.delete(sortedEntries[i][0]);
          }
        }
      }
     
      // Handle the message
      handler.handleMessage(sock, msg).catch(err => {
        // Avoid logging common, non-critical errors
        if (!err.message?.includes('rate-overlimit') &&
            !err.message?.includes('not-authorized')) {
          console.error(`❌ Error handling message from ${from}:`, err);
        }
      });
     
      // Auto-read messages in groups (if enabled)
      setImmediate(async () => {
        if (config.autoRead && from.endsWith('@g.us')) {
          try {
            await sock.readMessages([msg.key]);
          } catch (e) {
            // This can fail if the message is deleted, not a critical error
          }
        }
      });
    }
  });
 
  // Placeholder handlers for other events to prevent unhandled event warnings
  sock.ev.on('message-receipt.update', () => {});
  sock.ev.on('messages.update', () => {});
 
  // Handle group participant updates (welcome/goodbye)
  sock.ev.on('group-participants.update', async (update) => {
    await handler.handleGroupUpdate(sock, update);
  });
 
  // Handle socket errors
  sock.ev.on('error', (error) => {
    console.error('Socket error:', error);
  });
 
  return sock;
}

// ============================================
// Bot Startup
// ============================================
console.log('🚀 Starting WhatsApp MD Bot...\n');
console.log(`📦 Bot Name: ${config.botName}`);
console.log(`⚡ Prefix: ${config.prefix}`);
const ownerNames = Array.isArray(config.ownerName) ? config.ownerName.join(', ') : config.ownerName;
console.log(`👑 Owner: ${ownerNames}\n`);

// Clean up Puppeteer cache before starting to save disk space
cleanupPuppeteerCache();

// Start the bot
startBot().catch(err => {
  console.error('❌ Critical Error during bot startup:', err);
  process.exit(1);
});

// ============================================
// Global Error Handlers
// ============================================

// Handle uncaught exceptions to prevent the bot from crashing
process.on('uncaughtException', (err) => {
  // Handle specific "no space left on device" error
  if (err.code === 'ENOSPC' || err.errno === -28 || err.message?.includes('no space left on device')) {
    console.error('⚠️ ENOSPC Error: No space left on device. The bot may become unstable. Please clear some disk space.');
    // Attempt to run cleanup if possible
    try {
      const { cleanupOldFiles } = require('./utils/cleanup');
      cleanupOldFiles();
      console.warn('⚠️ Cleanup task attempted. Please verify disk space manually.');
    } catch (cleanupErr) {
      console.error('⚠️ Could not run cleanup task:', cleanupErr);
    }
    return;
  }
  console.error('💥 Uncaught Exception:', err, err.stack);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    // Handle specific "no space left on device" error
  if (err && (err.code === 'ENOSPC' || err.errno === -28 || err.message?.includes('no space left on device'))) {
    console.warn('⚠️ ENOSPC Error in promise: No space left on device. Attempting cleanup...');
    try {
      const { cleanupOldFiles } = require('./utils/cleanup');
      cleanupOldFiles();
      console.warn('⚠️ Cleanup task attempted. Please verify disk space manually.');
    } catch (cleanupErr) {
      console.error('⚠️ Could not run cleanup task:', cleanupErr);
    }
    return;
  }
 
  // Suppress common, non-critical rate limit errors from logging
  if (err && err.message && err.message.includes('rate-overlimit')) {
    console.warn('📈 Rate limit reached. Some requests may have been dropped.');
    return;
  }
  console.error('💥 Unhandled Rejection:', err, err.stack);
});

// Export store for external use (e.g., in plugins or external scripts)
module.exports = { store };
