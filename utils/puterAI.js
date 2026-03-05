const { init, getAuthToken } = require("@heyputer/puter.js/src/init.cjs");
const config = require('../config');
const fs = require('fs');
const path = require('path');

const CONNECTION_FILE = path.join(__dirname, '..', 'ai', 'puter_connection.json');
let puter;

/**
 * Ensures the 'ai' directory exists
 */
const ensureAiDir = () => {
    const aiDir = path.dirname(CONNECTION_FILE);
    if (!fs.existsSync(aiDir)) {
        fs.mkdirSync(aiDir, { recursive: true });
    }
};

/**
 * Saves the connection token to a file
 */
const saveConnection = (token) => {
    ensureAiDir();
    const data = {
        connected: true,
        token: token,
        timestamp: new Date().toISOString()
    };
    fs.writeFileSync(CONNECTION_FILE, JSON.stringify(data, null, 2));
};

/**
 * Removes the saved connection file
 */
const clearConnection = () => {
    if (fs.existsSync(CONNECTION_FILE)) {
        fs.unlinkSync(CONNECTION_FILE);
    }
    puter = null;
};

/**
 * Attempts to restore connection from file
 */
const restoreConnection = () => {
    if (fs.existsSync(CONNECTION_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(CONNECTION_FILE, 'utf8'));
            if (data.token) {
                puter = init(data.token);
                console.log('[PuterAI] Connection restored from saved session.');
                return true;
            }
        } catch (e) {
            console.error('[PuterAI] Failed to restore connection:', e.message);
        }
    }
    return false;
};

/**
 * Authenticates with Puter.js via browser
 */
async function authenticate() {
    try {
        console.log('[PuterAI] Requesting auth token (Browser might open)...');
        const token = await getAuthToken();
        puter = init(token);
        saveConnection(token);
        return true;
    } catch (error) {
        console.error('[PuterAI Auth Error]', error);
        throw error;
    }
}

const getPuter = () => {
    if (!puter) {
        if (!restoreConnection()) {
            console.log('[PuterAI] No active session. Use .auto-reply on to authenticate.');
        }
    }
    return puter;
};

/**
 * Loads AI instructions from JSON file
 */
const getInstructions = () => {
    try {
        const instrPath = path.join(__dirname, '..', 'ai', 'instructions.json');
        if (fs.existsSync(instrPath)) {
            return JSON.parse(fs.readFileSync(instrPath, 'utf8'));
        }
    } catch (e) {
        console.error('[PuterAI] Failed to load instructions.json:', e.message);
    }
    return { system_prompt: "You are EDBOTS AI assistant.", model: "gpt-4o-mini" };
};

/**
 * Generate an AI response using Puter.js
 * @param {string} text The user message
 * @returns {Promise<string>} The AI reply
 */
async function generateReply(text) {
    try {
        const client = getPuter();
        if (!client) return null; // Silently fail if not authenticated for auto-reply

        const instructions = getInstructions();
        const systemMessage = `${instructions.system_prompt} ${instructions.custom_instructions || ""}`.trim();

        const response = await client.ai.chat({
            model: instructions.model || "gpt-4o-mini",
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: text }
            ]
        });

        return response?.message?.content || response.toString() || "No response from AI.";
    } catch (error) {
        console.error('[PuterAI Error]', error);
        return null; // Don't spam error messages in auto-reply mode
    }
}

// Initialize on load
restoreConnection();

module.exports = { generateReply, authenticate, clearConnection };
