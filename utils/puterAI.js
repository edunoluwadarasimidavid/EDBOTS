/**
 * Puter AI Utility with Cloudflare Tunnel Support
 * Optimized for restricted container environments (Pterodactyl, Docker, etc.)
 */
const { init } = require("@heyputer/puter.js/src/init.cjs");
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const CONNECTION_FILE = path.join(__dirname, '..', 'ai', 'puter_connection.json');
let puter;
let tunnelProcess;

/**
 * Ensures the 'ai' directory exists for storing tokens
 */
const ensureAiDir = () => {
    const aiDir = path.dirname(CONNECTION_FILE);
    if (!fs.existsSync(aiDir)) {
        fs.mkdirSync(aiDir, { recursive: true });
    }
};

/**
 * Saves the Puter authentication token to a local file
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
 * Removes the saved connection and kills active tunnels
 */
const clearConnection = () => {
    if (fs.existsSync(CONNECTION_FILE)) {
        fs.unlinkSync(CONNECTION_FILE);
    }
    puter = null;
    if (tunnelProcess) {
        tunnelProcess.kill('SIGINT');
        tunnelProcess = null;
    }
};

/**
 * Attempts to restore Puter connection from saved file or config
 */
const restoreConnection = () => {
    // 1. Try saved connection file
    if (fs.existsSync(CONNECTION_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(CONNECTION_FILE, 'utf8'));
            if (data.token) {
                puter = init(data.token);
                console.log('[PuterAI] Connection restored from saved session.');
                return true;
            }
        } catch (e) {
            console.error('[PuterAI] Failed to restore connection file:', e.message);
        }
    }

    // 2. Fallback to config.js token
    try {
        const config = require('../config');
        if (config.puterToken) {
            puter = init(config.puterToken);
            console.log('[PuterAI] Connection restored from config.js token.');
            return true;
        }
    } catch (e) {
        // config might not be available yet or other error
    }

    return false;
};

/**
 * Starts a public authentication session using Cloudflare Tunnel (TryCloudflare)
 */
async function startAuthSession(options = {}) {
    return new Promise((resolveSession, rejectSession) => {
        // Create a local server to receive the Puter token callback
        const server = http.createServer();
        
        server.listen(0, '0.0.0.0', async function() {
            const port = this.address().port;
            console.log(`[Tunnel] Local callback server listening on port ${port}`);
            
            try {
                console.log('[Tunnel] Initializing Cloudflare Tunnel...');
                
                // Spawn Cloudflare Quick Tunnel using npx
                const tunnel = spawn('npx', [
                    '--yes', 
                    'cloudflared', 
                    'tunnel', 
                    '--url', `http://localhost:${port}`
                ], {
                    shell: true,
                    env: { ...process.env, NPM_CONFIG_YES: 'true' }
                });

                tunnelProcess = tunnel;
                let publicUrl = null;
                let outputBuffer = '';

                const handleData = (data) => {
                    const str = data.toString();
                    outputBuffer += str;
                    
                    // Regex to catch the TryCloudflare URL
                    const match = outputBuffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
                    if (match && !publicUrl) {
                        publicUrl = match[0];
                        console.log(`[Tunnel] Tunnel started successfully`);
                        console.log(`[Tunnel] Public URL: ${publicUrl}`);
                        
                        const authUrl = `https://puter.com/?action=authme&redirectURL=${encodeURIComponent(publicUrl)}`;
                        resolveSession({ 
                            url: authUrl, 
                            tokenPromise: createTokenPromise(server, publicUrl), 
                            publicUrl 
                        });
                    }
                };

                tunnel.stdout.on('data', handleData);
                tunnel.stderr.on('data', handleData);

                tunnel.on('error', (err) => {
                    console.error(`[Tunnel] Spawn error: ${err.message}`);
                    cleanup();
                    rejectSession(err);
                });

                tunnel.on('close', (code) => {
                    if (!publicUrl) {
                        console.error(`[Tunnel] Tunnel exited with code ${code}`);
                        cleanup();
                        rejectSession(new Error(`Tunnel exited with code ${code}`));
                    }
                });

                function cleanup() {
                    server.close();
                    if (tunnelProcess) {
                        tunnelProcess.kill('SIGINT');
                        tunnelProcess = null;
                    }
                }

                // Timeout after 90s (Cloudflare can be slow to download/start in some environments)
                setTimeout(() => {
                    if (!publicUrl) {
                        console.error('[Tunnel] Setup timed out after 90 seconds');
                        cleanup();
                        rejectSession(new Error('Tunnel timeout'));
                    }
                }, 90000);

            } catch (err) {
                console.error('[Tunnel] Setup error:', err);
                server.close();
                rejectSession(err);
            }
        });
    });
}

/**
 * Creates a promise that resolves when the Puter token is received
 */
function createTokenPromise(server, publicUrl) {
    return new Promise((resolveToken) => {
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
            
            // Close server and tunnel after token is captured
            setTimeout(() => {
                server.close();
                if (tunnel) {
                    tunnel.close();
                    tunnel = null;
                }
            }, 2000);
        });
    });
}

const getPuter = () => {
    if (!puter) restoreConnection();
    return puter;
};

const getInstructions = () => {
    try {
        const instrPath = path.join(__dirname, '..', 'ai', 'instructions.json');
        if (fs.existsSync(instrPath)) {
            return JSON.parse(fs.readFileSync(instrPath, 'utf8'));
        }
    } catch (e) {}
    return { system_prompt: "You are EDBOTS AI assistant.", model: "gpt-4o-mini" };
};

async function generateReply(text) {
    try {
        const client = getPuter();
        if (!client) {
            console.log('[PuterAI] No client found, returning NOT_CONNECTED');
            return "NOT_CONNECTED";
        }

        const instructions = getInstructions();
        const systemMessage = `${instructions.system_prompt} ${instructions.custom_instructions || ""}`.trim();
        const model = instructions.model || "gpt-4o";

        console.log(`[PuterAI] Sending request to model: ${model}`);

        const response = await client.ai.chat(text, {
            model: model,
            system_prompt: systemMessage
        });

        // Puter.js chat response can be a string or object with toString()
        const content = response?.message?.content || response?.toString() || "";
        
        if (!content || content.trim() === "") {
            console.error('[PuterAI] Received empty response from AI', response);
            return null;
        }

        return content;
    } catch (error) {
        console.error('[PuterAI Error]', error);
        return null;
    }
}

// Auto-restore session on startup
restoreConnection();

module.exports = { generateReply, startAuthSession, clearConnection };
