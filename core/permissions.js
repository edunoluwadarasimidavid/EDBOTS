/**
 * @file permissions.js
 * @description Helper functions for sender permission checks.
 *
 * Owner numbers come from the central config.js (derived from the
 * OWNER_NUMBER environment variable) in raw digit form; sender JIDs
 * are compared against the digit form. The old config/settings.js
 * placeholder listed a dummy number, so these checks never matched —
 * reading config.js fixes owner detection for .kick / .owner / premium.
 */

const config = require('../config');

/**
 * Checks if the sender is the owner of the bot.
 * @param {string} senderJid - The JID of the message sender.
 * @returns {boolean} True if the sender is an owner, false otherwise.
 */
function isOwner(senderJid) {
    const digits = String(senderJid || '').split('@')[0].replace(/[^0-9]/g, '');
    if (!digits) return false;
    return Array.isArray(config.owner) && config.owner.includes(digits);
}

module.exports = {
    isOwner
};
