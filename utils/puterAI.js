/**
 * @file puterAI.js
 * @description Puter AI account linking & AI access with tunnel support.
 *
 * Linking flow (interactive, WhatsApp-driven):
 *   1. Bot starts a local callback HTTP server
 *   2. Bot opens a public tunnel (Cloudflare quick-tunnel → localhosttunnel
 *      fallback → localtunnel.me fallback)
 *   3. Bot sends the Puter auth URL to the user (WhatsApp link preview)
 *   4. User clicks the link, registers/logs in on puter.com
 *   5. Puter redirects back to the tunnel with ?token=...
 *   6. Bot captures the token, saves it, and automatically notifies
 *      "✅ account linked" in the chat that requested it
 *
 * The @heyputer/puter.js npm package is optional: the bot boots fine
 * without it and simply reports "not linked".
 */

// Optional dependency: puter.js may not be installed. The bot must still
// boot without it — AI simply falls back to other providers.
let init = null;
try {
    ({ init } = require("@heyputer/puter.js/src/init.cjs"));
} catch (e) {
    // Not installed — init stays null and generateReply returns NOT_CONNECTED
}

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const CONNECTION_FILE = path.join(__dirname, '..', 'ai', 'puter_connection.json');
let puter = null;
let tunnelProcess = null;
let pendingSession = null; // { chatId, startedAt, tokenPromise, url }

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
    pendingSession = null;
    if (tunnelProcess) {
        try { tunnelProcess.kill('SIGINT'); } catch (e) {}
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
            if (data.token && init) {
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
        if (config.puterToken && init) {
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
 * Wait for a tunnel URL to appear in process output.
 * Supports Cloudflare quick tunnels (trycloudflare.com) and
 * localtunnel (loca.lt) which print their URL differently.
 */
function extractTunnelUrl(buffer) {
    let m = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (m) return m[0];
    m = buffer.match(/https:\/\/[a-z0-9-]+\.loca\.lt/i);
    if (m) return m[0];
    return null;
}

/**
 * Opens a public tunnel to the local callback server.
 * Tries, in order:
 *   1. cloudflared quick tunnel   (npx cloudflared)
 *   2. localtunnel                (npx lt --port)
 * Resolves with the public URL, rejects if all fail within 90s.
 */
function openTunnel(port) {
    return new Promise((resolve, reject) => {
        const attempts = [
            {
                name: 'cloudflared',
                cmd: ['--yes', 'cloudflared', 'tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate']
            },
            {
                name: 'localtunnel',
                cmd: ['--yes', 'localtunnel', '--port', String(port)]
            }
        ];

        let idx = 0;
        let settled = false;

        const tryNext = () => {
            if (settled) return;
            if (idx >= attempts.length) {
                settled = true;
                return reject(new Error('No tunnel provider available (need network + npx)'));
            }

            const attempt = attempts[idx++];
            console.log(`[Tunnel] Trying ${attempt.name}…`);

            let proc;
            try {
                proc = spawn('npx', attempt.cmd, {
                    shell: true,
                    env: { ...process.env, NPM_CONFIG_YES: 'true' }
                });
            } catch (err) {
                console.error(`[Tunnel] ${attempt.name} spawn failed:`, err.message);
                return tryNext();
            }

            tunnelProcess = proc;
            let buffer = '';
            let gotUrl = false;

            const onData = (data) => {
                buffer += data.toString();
                const url = extractTunnelUrl(buffer);
                if (url && !gotUrl) {
                    gotUrl = true;
                    settled = true;
                    console.log(`[Tunnel] Public URL (${attempt.name}): ${url}`);
                    resolve({ url, proc });
                }
            };

            proc.stdout.on('data', onData);
            proc.stderr.on('data', onData);

            proc.on('error', () => {
                if (!gotUrl) { settled = false; tryNext(); }
            });

            proc.on('close', () => {
                if (!gotUrl && !settled) tryNext();
            });
        };

        tryNext();

        // Global timeout
        setTimeout(() => {
            if (!settled) {
                settled = true;
                reject(new Error('Tunnel setup timed out after 90s'));
            }
        }, 90000);
    });
}

/**
 * Starts a public authentication session.
 *
 * @param {object} options
 * @param {string} [options.chatId] - WhatsApp chat that initiated the link
 * @returns {Promise<{url: string, tokenPromise: Promise<string|null>, publicUrl: string}>}
 */
async function startAuthSession(options = {}) {
    // Clean up any previous session
    if (pendingSession) {
        console.log('[PuterAuth] Replacing previous pending session');
    }

    return new Promise((resolveSession, rejectSession) => {
        // Create a local server to receive the Puter token callback
        const server = http.createServer((req, res) => {
            // Friendly landing page for every request
            const urlObj = new URL(req.url, 'http://localhost');
            const token = urlObj.searchParams.get('token');

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
                <html>
                    <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f2027; color: white;">
                        <div style="background: #203a43; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); text-align: center;">
                            <h1 style="color: #00F5FF;">${token ? '✅ Authentication Successful' : '⏳ Waiting for Puter…'}</h1>
                            <p>${token ? 'EDBots AI is now linked to your account.' : 'Complete login on puter.com; this page will update.'}</p>
                            <p style="opacity: 0.7;">You can now close this tab and return to WhatsApp.</p>
                        </div>
                    </body>
                </html>
            `);

            if (token) {
                console.log('[PuterAuth] Token received!');
                try {
                    if (init) puter = init(token);
                    saveConnection(token);
                } catch (e) {
                    console.error('[PuterAuth] Save/init error:', e.message);
                }
                if (pendingSession && pendingSession.resolveToken) {
                    pendingSession.resolveToken(token);
                }
                // Close tunnel + server shortly after capture
                setTimeout(() => {
                    try { server.close(); } catch (e) {}
                    if (tunnelProcess) {
                        try { tunnelProcess.kill('SIGINT'); } catch (e) {}
                        tunnelProcess = null;
                    }
                }, 2000);
            }
        });

        server.listen(0, '0.0.0.0', async function () {
            const port = this.address().port;
            console.log(`[PuterAuth] Local callback server on port ${port}`);

            try {
                const { url: publicUrl } = await openTunnel(port);

                const authUrl = `https://puter.com/?action=authme&redirectURL=${encodeURIComponent(publicUrl)}`;

                const tokenPromise = new Promise((resolveToken) => {
                    pendingSession = {
                        chatId: options.chatId || null,
                        startedAt: Date.now(),
                        authUrl,
                        resolveToken,
                        publicUrl
                    };
                });

                // Store resolver properly (promise executor runs sync)
                resolveSession({ url: authUrl, tokenPromise, publicUrl });
            } catch (err) {
                console.error('[PuterAuth] Tunnel setup failed:', err.message);
                try { server.close(); } catch (e) {}
                rejectSession(err);
            }
        });

        server.on('error', (err) => rejectSession(err));
    });
}

/**
 * Resolves when a pending auth session completes, or null.
 * Used by commands to await the user finishing the Puter login.
 */
function getPendingSession() {
    return pendingSession;
}

/**
 * Wait for token with timeout. Resolves token string or null on timeout.
 */
async function waitForToken(timeoutMs = 300000) {
    if (!pendingSession) return null;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (puter) return 'linked';
        await new Promise(r => setTimeout(r, 1000));
    }
    return null;
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
    return { system_prompt: "You are EDBots AI assistant.", model: "gpt-4o-mini" };
};

async function generateReply(text) {
    try {
        const client = getPuter();
        if (!client) {
            return "NOT_CONNECTED";
        }

        const instructions = getInstructions();
        const systemMessage = `${instructions.system_prompt} ${instructions.custom_instructions || ""}`.trim();
        const model = instructions.model || "gpt-4o";

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

/**
 * Link status for display in commands
 */
function getLinkStatus() {
    const linked = !!getPuter();
    let since = null;
    try {
        if (fs.existsSync(CONNECTION_FILE)) {
            const data = JSON.parse(fs.readFileSync(CONNECTION_FILE, 'utf8'));
            since = data.timestamp || null;
        }
    } catch (e) {}
    return {
        linked,
        since,
        packageInstalled: !!init,
        pending: !!pendingSession,
        pendingUrl: pendingSession?.authUrl || null
    };
}

// Auto-restore session on startup
restoreConnection();

module.exports = {
    generateReply,
    startAuthSession,
    clearConnection,
    getLinkStatus,
    getPendingSession,
    waitForToken
};
