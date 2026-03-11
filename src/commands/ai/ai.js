/**
 * AI Command
 */

const { askAI } = require('../../../utils/aiEngine');

module.exports = {
    name: "ai",
    aliases: ["bot", "ask", "edbot"],
    description: "Ask AI anything",
    cooldown: 5,
    category: "ai",

    execute: async (sock, parsed, args) => {
        const { from, msg, text } = parsed;
        
        if (!text) return sock.sendMessage(from, { text: "Please provide a question!" }, { quoted: msg });

        await sock.sendMessage(from, { text: "⏳ Thinking..." }, { quoted: msg });
        
        try {
            const answer = await askAI(text);
            await sock.sendMessage(from, { text: answer }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: "❌ AI error: " + err.message }, { quoted: msg });
        }
    }
};
