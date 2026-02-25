/**
 * =================================================================
 *                          EDBOT MAIN
 * =================================================================
 *
 * This is the main entry point for the EDBOT WhatsApp bot.
 *
 * Its primary responsibilities are:
 * 1. Setting up the environment: It tries to load environment variables
 *    from a `.env` file for local development. This is made optional
 *    to prevent crashes if `dotenv` is not installed or the file is
 *    missing, which is common in production.
 *
 * 2. Initializing the bot: It calls the main `initializeBot` function
 *    from `utils/session.js`, which contains all the core logic for
 *    session handling, connection, and event registration.
 *
 * 3. Handling fatal errors: It wraps the bot initialization in a
 *    try/catch block to log any critical errors that occur during
 *    startup and exits gracefully.
 */

// Import the core bot initializer.
const { initializeBot } = require('./utils/session');

/**
 * Loads environment variables from a .env file if available.
 * This is a helper for local development and is not required for production.
 */
function setupEnvironment() {
    try {
        // The dotenv package allows us to use a .env file for local configuration.
        require('dotenv').config();
        console.log('[SYSTEM] Loaded environment variables from .env file.');
    } catch (e) {
        // This is not an error in production, where variables are set directly.
        console.log('[SYSTEM] .env file not found or dotenv is not installed, proceeding with system environment variables.');
    }
}

/**
 * The main function that starts the application.
 */
async function main() {
    console.log('=================================================');
    console.log('            🚀 STARTING EDBOT V3 🚀             ');
    console.log('=================================================');

    // Set up environment variables for local development.
    setupEnvironment();

    try {
        // Defer to the session utility to handle all the complex setup.
        await initializeBot();
        console.log('[SYSTEM] ✅ Bot initialization process completed successfully.');
    } catch (error) {
        // If any unhandled error occurs during initialization, log it and exit.
        console.error('❌ FATAL ERROR DURING BOT INITIALIZATION ❌');
        console.error(error);
        process.exit(1);
    }
}

// Run the main function.
main();