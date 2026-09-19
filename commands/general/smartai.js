/**
 * Smart AI Command - Advanced AI with context memory and personality
 * Remembers conversations, detects language, adapts response style
 */

const { askAI } = require('../../utils/aiEngine');
const memory = require('../../utils/conversationMemory');
const modeManager = require('../../utils/modeManager');

module.exports = {
    name: 'chat',
    aliases: ['smartai', 'ask', 'ai'],
    category: 'ai',
    description: 'Chat with AI - remembers context and adapts to you',
    usage: '.chat <message> or just type your question',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            const question = args.join(' ');
            if (!question) {
                return extra.reply(
                    `🧠 *Smart AI Assistant*\n\n` +
                    `I remember our conversations and adapt to your style!\n\n` +
                    `*Features:*\n` +
                    `• 🧠 Context memory - I remember what we talked about\n` +
                    `• 🌍 Multi-language - I detect and respond in your language\n` +
                    `• 😊 Mood detection - I adjust to how you're feeling\n` +
                    `• 📚 Knowledge base - I can learn and remember things\n\n` +
                    `*Commands:*\n` +
                    `• \`.chat <question>\` - Ask me anything\n` +
                    `• \`.chat learn <key> <value>\` - Teach me something\n` +
                    `• \`.chat remember <query>\` - Search my memory\n` +
                    `• \`.chat profile\` - See your profile\n` +
                    `• \`.chat mood\` - Check your mood\n\n` +
                    `*Or just type naturally - I'll respond!*`
                );
            }

            // Handle sub-commands
            if (args[0] === 'learn') {
                const key = args[1];
                const value = args.slice(2).join(' ');
                if (!key || !value) return extra.reply('❌ Usage: `.chat learn <key> <value>`');
                memory.storeKnowledge(key, value, 'user_taught', extra.sender);
                return extra.reply(`✅ I'll remember that: *${key}* = ${value}`);
            }

            if (args[0] === 'remember' || args[0] === 'search') {
                const query = args.slice(1).join(' ');
                if (!query) return extra.reply('❌ Usage: `.chat remember <query>`');
                const results = memory.searchKnowledge(query);
                if (results.length === 0) return extra.reply(`🔍 I don't remember anything about "${query}"`);
                let text = `🔍 *Memory Search Results:*\n\n`;
                results.forEach((r, i) => {
                    text += `${i + 1}. *${r.key}*: ${r.value}\n   Category: ${r.category}\n`;
                });
                return extra.reply(text);
            }

            if (args[0] === 'profile') {
                const profile = memory.getUserProfile(extra.sender);
                const topCmds = Object.entries(profile.favoriteCommands)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5);
                const topTopics = Object.entries(profile.topics)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5);

                return extra.reply(
                    `👤 *Your Profile*\n\n` +
                    `📛 Name: ${profile.name || 'Not set'}\n` +
                    `🌍 Language: ${profile.language}\n` +
                    `💬 Interactions: ${profile.interactionCount}\n` +
                    `😊 Mood: ${profile.mood}\n` +
                    `🎯 Style: ${profile.preferredResponseStyle}\n` +
                    `📅 First seen: ${new Date(profile.firstSeen).toLocaleDateString()}\n\n` +
                    `*Top Commands:* ${topCmds.map(([k]) => k).join(', ') || 'None yet'}\n` +
                    `*Top Topics:* ${topTopics.map(([k]) => k).join(', ') || 'None yet'}`
                );
            }

            if (args[0] === 'mood') {
                const profile = memory.getUserProfile(extra.sender);
                return extra.reply(`😊 Your current mood: *${profile.mood}*\n\nI adjust my responses based on how you're feeling!`);
            }

            // Track this interaction
            memory.trackInteraction(extra.sender, 'chat', question);
            memory.addToHistory(extra.from, extra.sender, question, false);

            // Detect language
            const detectedLang = memory.detectLanguage(question);
            const sentiment = memory.analyzeSentiment(question);

            // Get conversation context
            const context = memory.getConversationContext(extra.from, 5);

            // Build enhanced prompt with context
            const currentMode = modeManager.getMode(extra.from);
            let enhancedQuestion = question;

            if (context) {
                enhancedQuestion = `Previous conversation:\n${context}\n\nCurrent question: ${question}`;
            }

            // Get AI response
            await extra.reply('🧠 Thinking...');
            const answer = await askAI(enhancedQuestion, currentMode === 'business' ? 'business' : 'personal');

            if (answer && !answer.startsWith('⚠️')) {
                // Store response in history
                memory.addToHistory(extra.from, 'bot', answer, true);

                // Update user profile
                memory.updateUserProfile(extra.sender, {
                    language: detectedLang,
                    mood: memory.analyzeSentiment(answer) === 'positive' ? 'happy' : profile?.mood || 'neutral'
                });

                await extra.reply(answer);
            } else {
                await extra.reply('🧠 I\'m still learning! Please try again or ask the owner to set up AI.');
            }

        } catch (error) {
            console.error('[SMART AI ERROR]', error);
            await extra.reply('❌ Error with AI. Please try again.');
        }
    }
};
