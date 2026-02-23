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
  useMultiFileAuthState,
  DisconnectReason,
  Browsers
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const config = require('./config');
const handler = require('./handler');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');

// ============================================
// Session Configuration
// Session files are stored in session/ folder
// ============================================
const SESSION_FOLDER = './session';
const SESSION_KEY_FILE = path.join(SESSION_FOLDER, 'session_key.js');
const CREDS_FILE = path.join(SESSION_FOLDER, 'creds.json');

/**
 * Ensure the session folder exists
 * Creates it recursively if missing
 */
function ensureSessionFolder() {
  if (!fs.existsSync(SESSION_FOLDER)) {
    fs.mkdirSync(SESSION_FOLDER, { recursive: true });
    console.log(`📁 Created session folder: ${SESSION_FOLDER}`);
  }
}

/**
 * Load session ID from multiple sources
 * Priority: 1. Environment variable, 2. session_key.js file
 * @returns {string} Session ID or empty string
 */
function loadSessionID() {
  // Priority 1: Environment variable
  if (process.env.SESSION_ID) {
    console.log('📡 Session: Loading from environment variable');
    return process.env.SESSION_ID;
  }

  // Priority 2: session_key.js file
  if (fs.existsSync(SESSION_KEY_FILE)) {
    try {
      // Clear require cache to get fresh data
      delete require.cache[require.resolve(SESSION_KEY_FILE)];
      const sessionKey = require(SESSION_KEY_FILE);
      
      if (sessionKey.sessionID) {
        console.log('📡 Session: Loading from session_key.js');
        return sessionKey.sessionID;
      }
    } catch (err) {
      console.warn('⚠️ Failed to load session_key.js:', err.message);
    }
  }

  return '';
}

/**
 * Process external session string and save to creds.json
 * Format: 'HEADER!BASE64DATA' (ED BOTS format)
 * @param {string} sessionString - The session string to process
 * @returns {boolean} Success status
 */
function processSessionString(sessionString) {
  if (!sessionString || !sessionString.includes('!')) {
    return false;
  }

  try {
    const [header, b64data] = sessionString.split('!');

    if (!header || !b64data) {
      throw new Error("Invalid session format. Expected 'HEADER!BASE64DATA'");
    }

    const cleanB64 = b64data.replace('...', '');
    const compressedData = Buffer.from(cleanB64, 'base64');
    const decompressedData = zlib.gunzipSync(compressedData);

    ensureSessionFolder();
    fs.writeFileSync(CREDS_FILE, decompressedData, 'utf8');
    console.log(`📡 Session: 🔑 Retrieved from ${header} Session`);
    return true;

  } catch (e) {
    console.error('📡 Session: ❌ Error processing session:', e.message);
    return false;
  }
}

/**
 * Save session ID to session_key.js file
 * This allows persistent session storage
 * @param {string} sessionString - Session string to save
 */
function saveSessionID(sessionString) {
  if (!sessionString) return;
  
  ensureSessionFolder();
  
  const fileContent = `/**
 * Session Key Storage - EDBOT
 * Built by: Edun Oluwadarasimi David
 * Keep this file secure and never commit to version control
 */

module.exports = {
    // Session ID from external source (ED BOTS format: 'HEADER!BASE64DATA')
    sessionID: '${sessionString}',
    
    // Timestamp when session was saved
    savedAt: '${new Date().toISOString()}'
};
`;
  
  try {
    fs.writeFileSync(SESSION_KEY_FILE, fileContent, 'utf8');
    console.log('💾 Session ID saved to session_key.js');
  } catch (err) {
    console.error('❌ Failed to save session ID:', err.message);
  }
}

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
  ensureSessionFolder();
  
  // Load and process session ID
  const sessionID = loadSessionID();
  
  if (sessionID) {
    const success = processSessionString(sessionID);
    if (success && process.env.SESSION_ID) {
      // If loaded from env, save to file for persistence
      saveSessionID(sessionID);
    }
  } else {
    console.log('📡 Session: No session ID found, waiting for QR code scan...');
  }
 
  // Initialize auth state with session folder
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_FOLDER);
 
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
      await sock.end(undefined, undefined, { reason: 'inactive' });
      clearInterval(watchdogInterval);
      setTimeout(() => startBot(), 5000);
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  sock.ev.on('connection.update', (update) => {
    const { connection } = update;
    if (connection === 'open') {
      lastActivity = Date.now();
    } else if (connection === 'close') {
      clearInterval(watchdogInterval);
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
      console.log('\n\n📱 Scan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }
   
    // Handle connection close
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
     
      if (statusCode === 515 || statusCode === 503 || statusCode === 408) {
        console.log(`⚠️ Connection closed (${statusCode}). Reconnecting...`);
      } else {
        console.log('Connection closed due to:', errorMessage, '\nReconnecting:', shouldReconnect);
      }
     
      if (shouldReconnect) {
        setTimeout(() => startBot(), 3000);
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
      
      // Update bio if enabled
      if (config.autoBio) {
        await sock.updateProfileStatus(`${config.botName} | Active 24/7`);
      }
      
      // Initialize anti-call feature
      handler.initializeAntiCall(sock);
      
      // Cleanup old chat messages
      const now = Date.now();
      for (const [jid, chatMsgs] of store.messages.entries()) {
        const timestamps = Array.from(chatMsgs.values()).map(m => m.messageTimestamp * 1000 || 0);
        if (timestamps.length > 0 && now - Math.max(...timestamps) > 24 * 60 * 60 * 1000) {
          store.messages.delete(jid);
        }
      }
      console.log(`🧹 Store cleaned. Active chats: ${store.messages.size}`);
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
     
      // Skip old messages (older than 5 minutes)
      const MESSAGE_AGE_LIMIT = 5 * 60 * 1000;
      let messageAge = 0;
      if (msg.messageTimestamp) {
        messageAge = Date.now() - (msg.messageTimestamp * 1000);
        if (messageAge > MESSAGE_AGE_LIMIT) continue;
      }
     
      processedMessages.add(msgId);
      
      // Store message in memory
      if (msg.key && msg.key.id) {
        if (!store.messages.has(from)) {
          store.messages.set(from, new Map());
        }
        const chatMsgs = store.messages.get(from);
        chatMsgs.set(msg.key.id, msg);
        
        // Keep only recent messages
        if (chatMsgs.size > store.maxPerChat) {
          const sortedIds = Array.from(chatMsgs.entries())
            .sort((a, b) => (a[1].messageTimestamp || 0) - (b[1].messageTimestamp || 0))
            .map(([id]) => id);
          for (let i = 0; i < sortedIds.length - store.maxPerChat; i++) {
            chatMsgs.delete(sortedIds[i]);
          }
        }
      }
     
      // Handle the message
      handler.handleMessage(sock, msg).catch(err => {
        if (!err.message?.includes('rate-overlimit') &&
            !err.message?.includes('not-authorized')) {
          console.error('Error handling message:', err.message);
        }
      });
     
      // Auto-read messages in groups (if enabled)
      setImmediate(async () => {
        if (config.autoRead && from.endsWith('@g.us')) {
          try {
            await sock.readMessages([msg.key]);
          } catch (e) {}
        }
      });
    }
  });
 
  // Placeholder handlers for other events
  sock.ev.on('message-receipt.update', () => {});
  sock.ev.on('messages.update', () => {});
 
  // Handle group participant updates (welcome/goodbye)
  sock.ev.on('group-participants.update', async (update) => {
    await handler.handleGroupUpdate(sock, update);
  });
 
  // Handle socket errors
  sock.ev.on('error', (error) => {
    const statusCode = error?.output?.statusCode;
    if (statusCode === 515 || statusCode === 503 || statusCode === 408) return;
    console.error('Socket error:', error.message || error);
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

// Clean up Puppeteer cache before starting
cleanupPuppeteerCache();

// Start the bot
startBot().catch(err => {
  console.error('Error starting bot:', err);
  process.exit(1);
});

// ============================================
// Error Handlers
// ============================================

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  if (err.code === 'ENOSPC' || err.errno === -28 || err.message?.includes('no space left on device')) {
    console.error('⚠️ ENOSPC Error: No space left on device. Attempting cleanup...');
    const { cleanupOldFiles } = require('./utils/cleanup');
    cleanupOldFiles();
    console.warn('⚠️ Cleanup completed. Bot will continue but may experience issues until space is freed.');
    return;
  }
  console.error('Uncaught Exception:', err, err.stack);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  if (err.code === 'ENOSPC' || err.errno === -28 || err.message?.includes('no space left on device')) {
    console.warn('⚠️ ENOSPC Error in promise: No space left on device. Attempting cleanup...');
    const { cleanupOldFiles } = require('./utils/cleanup');
    cleanupOldFiles();
    console.warn('⚠️ Cleanup completed. Bot will continue but may experience issues until space is freed.');
    return;
  }
 
  if (err.message && err.message.includes('rate-overlimit')) {
    console.warn('⚠️ Rate limit reached. Please slow down your requests.');
    return;
  }
  console.error('Unhandled Rejection:', err, err.stack);
});

// Export store for external use
module.exports = { store };
