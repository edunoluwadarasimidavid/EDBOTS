/**
 * @file engine.js
 * @description Facade for the connection engine.
 */

const { connectToWhatsApp } = require('./connection');
const { loadCommands } = require('../utils/commandLoader');

/**
 * Starts the bot by connecting to WhatsApp.
 */
async function startBot() {
    return await connectToWhatsApp();
}

module.exports = {
    startBot,
    loadCommands
};
