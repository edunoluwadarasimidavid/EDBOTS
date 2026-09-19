/**
 * Reusable AI Engine for EDBOTS
 * Primary: Puter AI (free, no API key needed)
 * Fallback: Multi-provider system (Groq, HuggingFace, SambaNova, OpenRouter)
 */

const { generateReply: puterGenerate } = require('./puterAI');
const { aiChat: multiProviderChat } = require('./aiProviders');

/**
 * Ask AI a question - tries Puter first, then multi-provider fallback
 * @param {string} question - The user's question
 * @param {string} mode - 'personal', 'business', 'group', etc.
 * @returns {string} AI response
 */
async function askAI(question, mode = 'personal') {
    try {
        if (!question || question.trim().length === 0) {
            return "Please provide a question for the AI.";
        }

        console.log(`[AI Engine] Processing: "${question.substring(0, 50)}..." (mode: ${mode})`);

        // 1. Try Puter AI first (primary provider - free, no key needed)
        try {
            const puterResponse = await puterGenerate(question);
            if (puterResponse && puterResponse !== "NOT_CONNECTED" && puterResponse.length > 5) {
                console.log('[AI Engine] Response from Puter AI');
                return puterResponse;
            }
            if (puterResponse === "NOT_CONNECTED") {
                console.log('[AI Engine] Puter not connected, trying multi-provider...');
            }
        } catch (puterErr) {
            console.log('[AI Engine] Puter failed:', puterErr.message);
        }

        // 2. Fallback to multi-provider system
        try {
            const multiResponse = await multiProviderChat(question, mode);
            if (multiResponse && multiResponse.length > 5) {
                console.log('[AI Engine] Response from multi-provider');
                return multiResponse;
            }
        } catch (multiErr) {
            console.log('[AI Engine] Multi-provider failed:', multiErr.message);
        }

        // 3. If Puter returned NOT_CONNECTED, show connection prompt
        return "⚠️ *AI Connection Required*\n\nPlease ask the bot owner to enable AI using:\n*.auto-reply on*\n\nOr set up a free AI provider:\n• `GROQ_API_KEY` (free at console.groq.com)\n• `SAMBANOVA_API_KEY` (free at cloud.sambanova.ai)";

    } catch (error) {
        console.error('[AI Engine Error]', error);
        return "❌ An error occurred while communicating with the AI. Please try again.";
    }
}

module.exports = { askAI };
