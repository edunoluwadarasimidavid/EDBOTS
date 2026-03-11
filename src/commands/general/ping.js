/**
 * Ping Command
 */

module.exports = {
    name: "ping",
    aliases: ["p", "latency"],
    description: "Check bot latency",
    cooldown: 5, // 5 seconds
    category: "general",

    execute: async (sock, parsed, args) => {
        const { from, msg } = parsed;
        const start = Date.now();
        await sock.sendMessage(from, { text: "Pinging..." }, { quoted: msg });
        const latency = Date.now() - start;
        await sock.sendMessage(from, { text: `Pong! Latency: ${latency}ms` }, { quoted: msg });
    }
};
