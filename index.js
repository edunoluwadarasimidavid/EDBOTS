/**
 * =================================================================
 *                          EDBOT V3
 * =================================================================
 *
 * This file is the main entry point for the Baileys WhatsApp bot.
 *
 * It is designed to be clean and simple, with two primary responsibilities:
 *
 * 1. Environment Setup:
 *    - It ensures a `.env.example` file exists to guide the user.
 *    - It loads environment variables from a `.env` file (if present)
 *      for easy local development. This is optional and safe for production.
 *
 * 2. Bot Initialization:
 *    - It calls the main `initializeBot` function located in `./utils/session.js`.
 *      All the complex logic for session handling, connection, and event
 *      registration is encapsulated in that file.
 *
 * This structure promotes a clean separation of concerns and makes the
 * project easier to understand and maintain.
 */

const fs = require('fs');
const path = require('path');
const { initializeBot } = require('./utils/session');

/**
 * Ensures that a `.env.example` file exists to guide the user.
 * If the file is missing, it creates one with helpful comments.
 */
function ensureEnvExampleExists() {
    const envExamplePath = path.join(__dirname, '.env.example');
    if (!fs.existsSync(envExamplePath)) {
        const exampleContent = `# -------------------------------------------------------------------
#         ENVIRONMENT VARIABLES FOR BAILEYS WHATSAPP BOT
#
# -> For local development, you can rename this file to \`.env\` and fill in the values.
# -> For production (Railway, Render, Docker), set these in your service's environment/secrets configuration.
# -------------------------------------------------------------------

# SESSION_ID: The most important variable for production deployments.
#
# HOW TO USE:
# 1. On your first run, leave this variable EMPTY.
# 2. Start the bot locally. You will be prompted to scan a QR code.
# 3. After scanning, the bot will generate and print a long SESSION_ID string in your console.
# 4. Copy that entire string and add it to your production environment variables.
SESSION_ID=

# BOT_NAME: The name for your bot, used in console logs.
BOT_NAME=EDBOT V3

# PORT: The server port for any web-related features.
PORT=3000
`;
        fs.writeFileSync(envExamplePath, exampleContent, 'utf8');
        console.log('[SYSTEM] Created .env.example file. Please configure it for your needs.');
    }
}

/**
 * Loads environment variables from a .env file for local development.
 * This is wrapped in a try/catch to make it optional.
 */
function setupEnvironment() {
    try {
        require('dotenv').config();
        console.log('[SYSTEM] Loaded environment variables from .env file.');
    } catch (e) {
        console.log('[SYSTEM] .env file not found or dotenv package not installed. Proceeding with system environment variables.');
    }
}

/**
 * The main function that starts the application.
 */
async function main() {
    console.log('=================================================');
    console.log('            🚀 STARTING EDBOT V3 🚀             ');
    console.log('=================================================');

    // 1. Ensure documentation and environment are set up.
    ensureEnvExampleExists();
    setupEnvironment();

    // 2. Defer to the session utility to handle all core logic.
    try {
        await initializeBot();
        console.log('[SYSTEM] ✅ Bot initialization process completed.');
    } catch (error) {
        console.error('❌ FATAL ERROR DURING BOT INITIALIZATION ❌');
        console.error(error);
        process.exit(1); // Exit with an error code.
    }
}

// Run the main function.
main();