const { askAI } = require('../../utils/aiEngine');

module.exports = {
    name: 'edbot-ai',
    execute: async (sock, msg, text) => {
        if (!text) return sock.sendMessage(msg.key.remoteJid, { text: "Usage: .edbot-ai [your question]" });
        
        await sock.sendMessage(msg.key.remoteJid, { text: "⏳ Thinking..." });
        
        const answer = await askAI(text);
        await sock.sendMessage(msg.key.remoteJid, { text: answer });
    }
};
