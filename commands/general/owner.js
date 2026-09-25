/**
 * Owner Command - Sends bot owner's contact card (vCard)
 */

const config = require('../../config');

module.exports = {
    name: 'owner',
    aliases: ['creator', 'dev', 'botowner'],
    category: 'general',
    description: 'Show bot owner contact information',
    usage: '.owner',
    ownerOnly: false,

    async execute(sock, msg, args, extra) {
        try {
            const chatId = extra.from;

            // Owner numbers array -> convert each to a vCard
            const ownerNames = Array.isArray(config.ownerName) ? config.ownerName : [config.ownerName];
            const ownerNumbers = Array.isArray(config.ownerNumber) ? config.ownerNumber.filter(Boolean) : [];
            if (ownerNumbers.length === 0) {
                return extra.reply('⚠️ No owner number configured. Add one to the owners list in config.js and restart.');
            }
            const vCards = ownerNumbers.map((num, index) => {
                const name = ownerNames[index] || ownerNames[0] || 'Bot Owner';
                return {
                    vcard: `
BEGIN:VCARD
VERSION:3.0
FN:${name}
TEL;waid=${num}:${num}
END:VCARD
                    `.trim()
                };
            });

            const displayName = ownerNames[0] || config.ownerName || 'Bot Owner';

            await sock.sendMessage(chatId, {
                contacts: {
                    displayName: displayName,
                    contacts: vCards
                }
            });

            await extra.reply('👑 Here is the contact of my *Owner*.');

        } catch (error) {
            console.error('Owner command error:', error);
            await extra.reply(`❌ Error: ${error.message}`);
        }
    }
};
