/**
 * Analyze Command - Advanced text analysis
 * Sentiment, readability, word count, language detection, and more
 */

const { aiChat } = require('../../utils/aiProviders');
const memory = require('../../utils/conversationMemory');

module.exports = {
    name: 'analyze',
    aliases: ['textstats', 'check', 'proofread'],
    category: 'utility',
    description: 'Analyze text for sentiment, readability, and statistics',
    usage: '.analyze <text> or reply to a message',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            let text = '';

            // Check for quoted message
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted) {
                text = quoted.conversation ||
                    quoted.extendedTextMessage?.text ||
                    quoted.imageMessage?.caption ||
                    quoted.videoMessage?.caption || '';
            } else if (args.length > 0) {
                text = args.join(' ');
            }

            if (!text || text.length < 5) {
                return extra.reply(
                    `📊 *Text Analyzer*\n\n` +
                    `*Usage:*\n` +
                    `• \`.analyze <text>\` - Analyze any text\n` +
                    `• Reply to a message with \`.analyze\`\n\n` +
                    `*I analyze:*\n` +
                    `• 📊 Word & character count\n` +
                    `• 😊 Sentiment (positive/negative/neutral)\n` +
                    `• 🌍 Language detection\n` +
                    `• 📖 Readability score\n` +
                    `• 💡 AI insights`
                );
            }

            // Basic statistics
            const words = text.split(/\s+/).filter(w => w.length > 0);
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
            const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
            const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
            const avgSentenceLength = words.length / Math.max(sentences.length, 1);

            // Sentiment analysis
            const sentiment = memory.analyzeSentiment(text);

            // Language detection
            const lang = memory.detectLanguage(text);

            // Readability score (simple Flesch-like)
            const syllables = words.reduce((sum, w) => {
                return sum + Math.max(1, w.replace(/[^aeiouy]/gi, '').length);
            }, 0);
            const readability = Math.max(0, Math.min(100,
                206.835 - 1.015 * avgSentenceLength - 84.6 * (syllables / words.length)
            ));

            let readabilityLabel = 'Very Easy';
            if (readability < 30) readabilityLabel = 'Very Difficult';
            else if (readability < 50) readabilityLabel = 'Difficult';
            else if (readability < 60) readabilityLabel = 'Standard';
            else if (readability < 70) readabilityLabel = 'Fairly Easy';

            // Build result
            let result = `📊 *Text Analysis*\n\n`;

            result += `📝 *Basic Stats:*\n`;
            result += `• Characters: ${text.length}\n`;
            result += `• Words: ${words.length}\n`;
            result += `• Sentences: ${sentences.length}\n`;
            result += `• Paragraphs: ${paragraphs.length}\n`;
            result += `• Avg word length: ${avgWordLength.toFixed(1)} chars\n`;
            result += `• Avg sentence length: ${avgSentenceLength.toFixed(1)} words\n\n`;

            result += `😊 *Sentiment:* ${sentiment}\n`;
            result += `🌍 *Language:* ${lang}\n`;
            result += `📖 *Readability:* ${readability.toFixed(0)}/100 (${readabilityLabel})\n\n`;

            // Most common words
            const wordFreq = {};
            words.forEach(w => {
                const lower = w.toLowerCase().replace(/[^a-z]/g, '');
                if (lower.length > 3) wordFreq[lower] = (wordFreq[lower] || 0) + 1;
            });
            const topWords = Object.entries(wordFreq)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            if (topWords.length > 0) {
                result += `🔤 *Top Words:* ${topWords.map(([w, c]) => `${w}(${c})`).join(', ')}\n`;
            }

            // AI insights (optional)
            if (text.length > 50) {
                try {
                    const prompt = `Analyze this text briefly (2-3 sentences): what is the main topic, tone, and any suggestions for improvement?\n\n${text.slice(0, 1000)}`;
                    const insights = await aiChat(prompt, 'personal');
                    if (insights && insights.length > 10) {
                        result += `\n💡 *AI Insights:*\n${insights}`;
                    }
                } catch (e) {}
            }

            await extra.reply(result);

        } catch (error) {
            console.error('[ANALYZE ERROR]', error);
            await extra.reply('❌ Analysis failed.');
        }
    }
};
