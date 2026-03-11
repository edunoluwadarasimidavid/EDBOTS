/**
 * @file menu.js
 * @description Dynamic menu command with categorization.
 */

const developer = require("../../core/developer");
const settings = require("../../config/settings");
const os = require("os");

module.exports = {
    name: "menu",
    aliases: ["help", "list", "commands"],
    async execute(sock, msg, args) {
        try {
            const senderJid = msg.key.remoteJid;
            const user = msg.pushName || "User";

            // Simple uptime calculation
            const uptime = process.uptime();
            const uptimeString = new Date(uptime * 1000).toISOString().substr(11, 8);

            const menuText = `
╭─── *${settings.botName.toUpperCase()}* ───
│ 👋 Hi, *${user}*!
│ 🤖 Developer: ${developer.developer}
│ ⏳ Uptime: ${uptimeString}
│ 💻 Platform: ${os.platform()}
│ 🔗 Repo: ${developer.repository}
╰──────────────────

*Available Commands:*

╭── *General* ──
│ • ${settings.prefix}menu
│ • ${settings.prefix}ping
╰───────────────

╭── *Admin* ──
│ • ${settings.prefix}kick (Group Only)
│ • ${settings.prefix}promote (Group Only)
╰─────────────

_Type ${settings.prefix}help <command> for details._
            `.trim();

            // Send with a proper "context info" for a richer look (optional but good)
            await sock.sendMessage(senderJid, { 
                text: menuText,
                contextInfo: {
                    externalAdReply: {
                        title: settings.botName,
                        body: "Advanced WhatsApp Automation",
                        thumbnailUrl: "https://telegra.ph/file/example-image.jpg", // Placeholder
                        sourceUrl: developer.repository,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: msg });

        } catch (error) {
            console.error("Menu command error:", error);
            await sock.sendMessage(msg.key.remoteJid, { text: "Failed to load menu." });
        }
    }
};
