/**
 * @file index.js
 * @description Secure Entry Point for EDBOTS.
 */

const { startBot } = require("./core/engine");
require("dotenv").config();
const developer = require("./core/developer");
const fs = require("fs");
const path = require("path");
const { initializeCrashProtection } = require("./utils/crashProtector");
const { startCleanup } = require("./utils/cleanup");

// REST API control layer (additive): starts alongside the bot unless
// EDBOTS_API_ENABLED=false. Non-fatal on failure — the bot always runs.
let apiStarted = false;
function ensureApiServer() {
    if (apiStarted) return;
    apiStarted = true;
    try {
        const apiConfig = require("./api/core/config");
        if (!apiConfig.enabled) {
            console.log("\x1b[33m[API] Disabled via EDBOTS_API_ENABLED=false\x1b[0m");
            return;
        }
        const { start } = require("./api/server");
        start();
    } catch (err) {
        console.error("\x1b[31m[API] Failed to start REST API (bot continues):\x1b[0m", err.message);
    }
}

/**
 * Global Process Safety - Single consolidated crash handler
 * Uses the crashProtector module for consistency
 */
initializeCrashProtection();

/**
 * Pre-Flight Checks
 */
function ensureDirectories() {
    const dirs = ["commands", "session", "temp", "database"];
    dirs.forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`\x1b[33m[SETUP] Created missing directory: ${dir}\x1b[0m`);
        }
    });
}

/**
 * Main Initialization
 */
(async () => {
    try {
        console.clear(); 
        
        // 1. Security Check
        developer.checkIntegrity();

        // 2. Environment Setup
        ensureDirectories();

        // 3. Start temp file cleanup system
        startCleanup();

        // 3.5 Start REST API control layer
        ensureApiServer();

        console.log("\x1b[34m[INFO] Initializing EDBOTS System...\x1b[0m");
        
        // 4. Start Bot Engine
        await startBot();

    } catch (error) {
        console.error("\x1b[31m[FATAL] Initialization failed:\x1b[0m", error);
        process.exit(1);
    }
})();
