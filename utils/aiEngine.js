/**
 * Reusable AI Engine for EDBOTS
 * Interfaces with Puter AI or other providers
 */
const { generateReply } = require('./puterAI');

async function askAI(question) {
    try {
        if (!question || question.trim().length === 0) {
            return "Please provide a question for the AI.";
        }
        
        console.log(`[AI Engine] Processing question: ${question.substring(0, 50)}...`);
        
        // Calling our previously established Puter AI logic
        const response = await generateReply(question);
        
        if (response === "NOT_CONNECTED") {
            return "⚠️ *AI Connection Required*\n\nPlease ask the bot owner to enable AI using:\n*.auto-reply on*";
        }
        
        if (!response) {
            return "⚠️ AI service is currently unavailable. Please try again later.";
        }
        
        return response;
    } catch (error) {
        console.error('[AI Engine Error]', error);
        return "❌ An error occurred while communicating with the AI. Please try again.";
    }
}

module.exports = { askAI };
