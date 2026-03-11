/**
 * @file permissions.js
 * @description Helper functions for sender permission checks.
 */

const settings = require('../config/settings');

/**
 * Checks if the sender is the owner of the bot.
 * @param {string} senderJid - The JID of the message sender.
 * @returns {boolean} True if the sender is an owner, false otherwise.
 */
function isOwner(senderJid) {
    return settings.ownerNumber.includes(senderJid);
}

module.exports = {
    isOwner
};
