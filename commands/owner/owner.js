/**
 * @file owner.js
 * @description Owner-only administrative dashboard.
 */

const { isOwner } = require("../../core/permissions");

module.exports = {
    name: "owner",
    aliases: ["admin"],
    async execute(sock, msg, args) {
        const senderJid = msg.key.remoteJid;
        
        // Use senderJid directly or participant if in group
        const userJid = msg.key.participant || senderJid;

        if (!isOwner(userJid)) {
            return sock.sendMessage(senderJid, { text: "⚠️ Access Denied: This command is restricted to the bot owner." }, { quoted: msg });
        }

        await sock.sendMessage(senderJid, { text: "👑 *Owner Dashboard*

You have full access to the system." }, { quoted: msg });
    }
};
