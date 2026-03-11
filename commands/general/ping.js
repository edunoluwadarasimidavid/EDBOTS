/**
 * @file ping.js
 * @description System status check.
 */

module.exports = {
    name: "ping",
    aliases: ["status", "info"],
    async execute(sock, msg, args) {
        const start = Date.now();
        const senderJid = msg.key.remoteJid;

        // Calculate latency
        const latency = Date.now() - start;

        // Memory Usage
        const memory = process.memoryUsage();
        const ramUsage = (memory.rss / 1024 / 1024).toFixed(2);

        await sock.sendMessage(senderJid, { 
            text: `*Pong!* 🏓\n\n⚡ Latency: ${latency}ms\n💾 RAM Usage: ${ramUsage} MB` 
        }, { quoted: msg });
    }
};
