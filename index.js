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

        console.log("\x1b[34m[INFO] Initializing EDBOTS System...\x1b[0m");
        
        // 4. Start Bot Engine
        await startBot();

    } catch (error) {
        console.error("\x1b[31m[FATAL] Initialization failed:\x1b[0m", error);
        process.exit(1);
    }
})();
