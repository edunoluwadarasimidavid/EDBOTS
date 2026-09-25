/**
 * Ollama Command - Connect to local Ollama AI models
 * For users who want to run AI locally
 */

const axios = require('axios');
const config = require('../../config');

// URL preference lives in config.js (ai.ollamaUrl); an env override is kept
// for local dev convenience but is not part of the shipped template.
const OLLAMA_URL = process.env.OLLAMA_URL || config.ai.ollamaUrl;

module.exports = {
    name: 'ollama',
    aliases: ['localai', 'local'],
    category: 'ai',
    description: 'Chat with local Ollama AI models',
    usage: '.ollama <message> or .ollama models',
    visibility: 'private',

    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                return extra.reply(
                    `🤖 *Local AI (Ollama)*\n\n` +
                    `*Usage:*\n` +
                    `• \`.ollama <question>\` - Chat with local AI\n` +
                    `• \`.ollama models\` - List available models\n` +
                    `• \`.ollama status\` - Check connection\n\n` +
                    `*Setup:*\n` +
                    `1. Install Ollama: https://ollama.ai\n` +
                    `2. Pull a model: \`ollama pull llama3.1\`\n` +
                    `3. Edit ai.ollamaUrl in config.js (default: localhost:11434)`
                );
            }

            const action = args[0].toLowerCase();

            if (action === 'status') {
                try {
                    const res = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
                    const models = res.data?.models || [];
                    return extra.reply(`✅ *Ollama Connected!*\n\n📦 Models: ${models.map(m => m.name).join(', ') || 'None'}`);
                } catch (e) {
                    return extra.reply(`❌ Cannot connect to Ollama at ${OLLAMA_URL}\n\nMake sure Ollama is running.`);
                }
            }

            if (action === 'models') {
                try {
                    const res = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
                    const models = res.data?.models || [];
                    if (models.length === 0) return extra.reply('📭 No models installed. Run `ollama pull llama3.1` to install one.');

                    let text = `📦 *Available Models:*\n\n`;
                    models.forEach((m, i) => {
                        const size = m.size ? `${(m.size / 1e9).toFixed(1)}GB` : 'Unknown';
                        text += `${i + 1}. *${m.name}* (${size})\n`;
                    });
                    return extra.reply(text);
                } catch (e) {
                    return extra.reply(`❌ Cannot connect to Ollama.`);
                }
            }

            // Chat with local AI
            const question = args.join(' ');
            await extra.reply('🤖 Thinking locally...');

            try {
                const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
                    model: 'llama3.1',
                    prompt: question,
                    stream: false
                }, { timeout: 60000 });

                const response = res.data?.response;
                if (response) {
                    await extra.reply(`🤖 *Local AI:*\n\n${response}`);
                } else {
                    await extra.reply('❌ No response from local AI.');
                }
            } catch (e) {
                if (e.code === 'ECONNREFUSED') {
                    await extra.reply(`❌ Cannot connect to Ollama at ${OLLAMA_URL}\n\nMake sure Ollama is running.`);
                } else {
                    await extra.reply(`❌ Error: ${e.message}`);
                }
            }

        } catch (error) {
            console.error('[OLLAMA ERROR]', error);
            await extra.reply('❌ Local AI error.');
        }
    }
};
