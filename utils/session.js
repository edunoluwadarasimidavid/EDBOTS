const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');

// Define the path for the session directory, locating it in the project root.
const SESSION_DIR = path.join(__dirname, '..', 'session');

/**
 * Ensures that the session directory exists.
 * If it doesn't exist, it will be created recursively.
 * This is a critical first step before any file operations in the session directory.
 */
function ensureSessionDirectoryExists() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    console.log(`[SESSION] 📁 Created session directory at: ${SESSION_DIR}`);
  }
}

/**
 * Decodes a session string from an environment variable and writes it to `creds.json`.
 * This allows for stateless containers to be pre-authenticated.
 * The function is designed to be resilient, catching errors from malformed session strings
 * without crashing the application.
 */
function restoreSessionFromEnv() {
  const sessionID = process.env.SESSION_ID;

  if (sessionID) {
    console.log('[SESSION] 📡 Attempting to restore session from environment variable...');
    try {
      // The session string is expected in the format 'HEADER!BASE64DATA'
      const [header, b64data] = sessionID.split('!');
      if (!header || !b64data) {
        throw new Error("Invalid SESSION_ID format. Expected 'HEADER!BASE64DATA'.");
      }

      // Clean up potential '...' suffix from the Base64 data.
      const cleanB64 = b64data.replace('...', '');
      const compressedData = Buffer.from(cleanB64, 'base64');
      
      // Decompress the data to get the original JSON content.
      const decompressedData = zlib.gunzipSync(compressedData);
      
      const credsPath = path.join(SESSION_DIR, 'creds.json');
      fs.writeFileSync(credsPath, decompressedData, 'utf8');
      
      console.log(`[SESSION] ✅ Session successfully restored from [${header}] and saved to creds.json.`);
    } catch (error) {
      console.error(`[SESSION] ❌ Failed to restore session from environment variable: ${error.message}`);
    }
  } else {
    // This is a normal startup scenario, not an error.
    console.log('[SESSION] 💡 No SESSION_ID found in environment. A new session will be created if needed.');
  }
}

/**
 * Initializes the Baileys authentication state.
 * It orchestrates the session setup by ensuring the directory exists,
 * restoring from the environment if possible, and then loading the state using `useMultiFileAuthState`.
 * This replaces the old, error-prone `require('session/session_key.js')` system.
 *
 * @returns {Promise<{state: object, saveCreds: function}>} The auth state and saveCreds function for Baileys.
 */
async function initializeAuth() {
  // Always ensure the session directory is ready.
  ensureSessionDirectoryExists();
  
  // Create `creds.json` if the SESSION_ID environment variable is provided.
  restoreSessionFromEnv();

  // `useMultiFileAuthState` will now either load the restored session from `creds.json`
  // or create a new one. It handles all file creation and updates automatically.
  console.log('[SESSION] 🔐 Initializing Baileys multi-file authentication state...');
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  console.log('[SESSION] ✅ Baileys auth state initialized.');

  return { state, saveCreds };
}

/**
 * Generates a portable session string from the `creds.json` file.
 * This function is called after a new session is created (i.e., after scanning a QR code),
 * allowing the user to copy the session string and use it as an environment variable
 * for future runs, eliminating the need for repeated QR scans.
 *
 * @returns {string|null} The generated session string (e.g., 'EDBOTS!BASE64DATA') or null on failure.
 */
function generateSessionString() {
  const credsPath = path.join(SESSION_DIR, 'creds.json');
  if (fs.existsSync(credsPath)) {
    try {
      const credsContent = fs.readFileSync(credsPath, 'utf8');
      const compressed = zlib.gzipSync(credsContent);
      const b64 = compressed.toString('base64');
      // The 'EDBOTS' header is added for identification.
      const sessionID = `EDBOTS!${b64}`;
      return sessionID;
    } catch (error) {
      console.error('[SESSION] ❌ Failed to generate session string:', error.message);
      return null;
    }
  }
  return null;
}

module.exports = { initializeAuth, generateSessionString, SESSION_DIR };
