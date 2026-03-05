const { init } = require("@heyputer/puter.js/src/init.cjs");
const config = require('../config');
const fs = require('fs');
const path = require('path');
const http = require('http');
const localtunnel = require('localtunnel');

const CONNECTION_FILE = path.join(__dirname, '..', 'ai', 'puter_connection.json');
let puter;
let tunnel;

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
    if (tunnel) {
        tunnel.close();
        tunnel = null;
    }
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
 * Starts an authentication session and returns the public URL and a promise for the token
 */
async function startAuthSession(options = {}) {
    return new Promise((resolveSession, rejectSession) => {
        const server = http.createServer();
        
        server.listen(0, '0.0.0.0', async function() {
            const port = this.address().port;
            
            try {
                // Initialize localtunnel to expose the local server
                tunnel = await localtunnel({ 
                    port,
                    subdomain: options.subdomain || undefined
                });
                const publicUrl = tunnel.url;
                
                console.log(`[PuterAI] Tunnel created: ${publicUrl}`);
                
                // Puter's redirectURL typically expects a URL that the browser can reach.
                const authUrl = `https://puter.com/?action=authme&redirectURL=${encodeURIComponent(publicUrl)}`;
                
                const tokenPromise = new Promise((resolveToken) => {
                    server.on('request', (req, res) => {
                        const urlObj = new URL(req.url, publicUrl);
                        const token = urlObj.searchParams.get('token');
                        
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(`
                            <html>
                                <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f2027; color: white;">
                                    <div style="background: #203a43; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); text-align: center;">
                                        <h1 style="color: #00F5FF;">✅ Authentication Successful</h1>
                                        <p>EDBOTS AI is now linked to your account.</p>
                                        <p style="opacity: 0.7;">You can now close this tab and return to WhatsApp.</p>
                                    </div>
                                </body>
                            </html>
                        `);

                        if (token) {
                            puter = init(token);
                            saveConnection(token);
                            resolveToken(token);
                        }
                        
                        setTimeout(() => {
                            server.close();
                            if (tunnel) {
                                tunnel.close();
                                tunnel = null;
                            }
                        }, 2000);
                    });
                });

                resolveSession({ url: authUrl, tokenPromise, publicUrl });
            } catch (err) {
                console.error('[PuterAI] Localtunnel error:', err);
                server.close();
                rejectSession(err);
            }
        });
    });
}

const getPuter = () => {
    if (!puter) {
        restoreConnection();
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
        if (!client) return null;

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
        return null;
    }
}

// Initialize on load
restoreConnection();

module.exports = { generateReply, startAuthSession, clearConnection };
