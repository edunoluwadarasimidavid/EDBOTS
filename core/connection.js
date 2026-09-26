/**
 * @file connection.js
 * @description Hardened WhatsApp connection engine with auto-repair and session safety.
 */

const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    delay,
    DisconnectReason
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');
const qrcode = require('qrcode-terminal');
const { Boom } = require('@hapi/boom');
const config = require('../config');
const { loadCommands } = require('../utils/commandLoader');
const { handleMessage } = require('./handler');
const { selfRepair } = require('../utils/selfRepair');
const { handleAuthFailure, safeWriteAuth } = require('../utils/sessionManager');

// Control-layer bridge (additive): lets the REST API observe status and
// stop/start the bot without touching Baileys internals or message handling.
const botState = require('./botState');

// Auth state/event hub: publishes REAL Baileys events (QR, pairing code,
// connected, logged out) to the web pairing interface via SSE.
const authEvents = require('./authEvents');

// REST API control layer (additive). Starts once per process; failures are
// non-fatal so the bot always keeps working even if the API cannot bind.
let apiStarted = false;
function ensureApiServer() {
    if (apiStarted) return;
    apiStarted = true;
    try {
        const { start } = require('../api/server');
        start();
    } catch (err) {
        console.error('\x1b[31m[API] Failed to start REST API (bot continues):\x1b[0m', err.message);
    }
}

// Global state
let sock = null;             // current socket (also mirrored in botState)
let reconnectAttempts = 0;
let commands = new Map();

// Single-flight reconnect guard: at most one reconnect pipeline may run at a
// time. setConnecting prevents close-handler races where two connection.update
// events (or an API start + a close event) each call connectToWhatsApp() and
// spawn two sockets — the direct cause of connectionReplaced (440) loops.
let connecting = false;

// Pending reconnect timer — so a newer connect call can cancel a scheduled
// reconnect (e.g. user hits POST /api/bot/start during backoff).
let reconnectTimer = null;

// Pairing-code state (reset per connection attempt)
let pairingRequested = false;
let pairingFailed = false;

// Logger setup
const logger = pino({ level: 'silent' });

// Session path
const SESSION_DIR = path.join(__dirname, '..', config.sessionName || 'session');

/**
 * Interactive Question Helper
 */
const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(text, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
};

/**
 * Headless web-pairing banner. The URL is auto-detected (config.js override,
 * platform env, or learned from the first browser request) — no env var
 * setup is required. Every address candidate is honestly labeled, because
 * container platforms hand out internal-only IPs (172.x) that cannot be
 * opened from the internet.
 */
const printWebPairingBanner = () => {
    let webPairConfig = null;
    try {
        webPairConfig = require('../api/webpair/config');
    } catch {
        webPairConfig = null;
    }

    console.log('\n');
    console.log('\x1b[1m\x1b[36m╭────────────────────────────────────────────╮\x1b[0m');
    console.log('\x1b[1m\x1b[36m│        EDBOTS Web Authentication           │\x1b[0m');
    console.log('\x1b[1m\x1b[36m╰────────────────────────────────────────────╯\x1b[0m');
    console.log('');

    const candidates = webPairConfig ? webPairConfig.candidates() : [];
    if (candidates.length > 0) {
        console.log('\x1b[1m  Open in your browser:\x1b[0m');
        for (const c of candidates) {
            const mark = c.reachable ? '\x1b[1m\x1b[32m' : '\x1b[2m';
            console.log(`  ${mark}${c.url}\x1b[0m \x1b[2m(${c.label})\x1b[0m`);
        }
    } else {
        const port = webPairConfig ? webPairConfig.port : 3000;
        console.log(`\x1b[36m  Open http://<this-server>:${port}/pair\x1b[0m`);
    }

    console.log('');
    console.log('\x1b[2m  Hosted behind a domain/proxy? Just open https://your-domain/pair —\x1b[0m');
    console.log('\x1b[2m  the exact URL is learned from your visit and confirmed here.\x1b[0m');
    console.log('');

    // Fire-and-forget: when the server's true public IP resolves, print it.
    // Never blocks startup; silently skipped on offline firewalled hosts.
    try {
        const { fetchPublicIp } = require('../api/webpair/publicUrl');
        fetchPublicIp().then((ip) => {
            if (ip && webPairConfig) {
                webPairConfig.setPublicIp(ip);
                console.log(`\x1b[36m[AUTH] Server public IP: ${ip} — if hosted on a VPS, http://${ip}:${webPairConfig.port}/pair may work (port must be open).\x1b[0m`);
            }
        }).catch(() => {});
    } catch {
        /* public IP detection is best-effort only */
    }
};

/**
 * Display the pairing code prominently
 */
const showPairingCode = (code) => {
    const formatted = (code || '').match(/.{1,4}/g)?.join('-') || code;
    console.log('\n');
    console.log('\x1b[1m\x1b[36m╔══════════════════════════════════════════╗\x1b[0m');
    console.log('\x1b[1m\x1b[36m║           EDBots Pairing Code            ║\x1b[0m');
    console.log('\x1b[1m\x1b[36m╚══════════════════════════════════════════╝\x1b[0m');
    console.log('');
    console.log(`\x1b[1m\x1b[32m         ${formatted}         \x1b[0m`);
    console.log('');
    console.log('\x1b[0mOpen WhatsApp → Linked Devices → Link with Phone Number');
    console.log('Enter the code above when prompted.\x1b[0m');
    console.log('');
};

/**
 * Schedule exactly ONE reconnect attempt after an exponential backoff.
 *
 * - The pending timer is stored globally so a newer connect request (e.g.
 *   POST /api/bot/start) can cancel it.
 * - connectToWhatsApp() re-acquires the single-flight lock on entry, so the
 *   scheduled attempt can never race another one.
 * - Never gives up and never exits the process: PM2 only needs to handle real
 *   crashes; WhatsApp recovery is this module's job.
 */
const scheduleReconnect = (statusCode, reasonName, error) => {
    reconnectAttempts++;

    // restartRequired (515) is WhatsApp itself asking for a quick reconnect —
    // keep that one fast instead of backing off.
    const delayMs = statusCode === DisconnectReason.restartRequired
        ? 2000
        : Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);

    console.warn(`  willReconnect : true (temporary failure)`);
    console.warn(`  nextRetryIn   : ${Math.round(delayMs / 1000)}s`);
    if (reconnectAttempts % 10 === 0) {
        console.log('\x1b[36m[CONNECTION] Still retrying — check network/DNS. Tip: edbots doctor\x1b[0m');
    }
    void reasonName; void error; // already logged by the caller

    // The current pipeline ends here; release the single-flight lock so the
    // scheduled attempt may run (it re-acquires the lock on entry).
    connecting = false;

    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectToWhatsApp().catch((err) => {
            console.error('[CONNECTION] Reconnect attempt error:', err && err.message ? err.message : err);
            connecting = false;
            scheduleReconnect(null, 'reconnect_error', err);
        });
    }, delayMs);
};

/**
 * Main Connection Function
 */
const connectToWhatsApp = async () => {
    // Single-flight guard: never allow two connect pipelines (boot, API
    // start, scheduled reconnect) to run concurrently — that is how duplicate
    // sockets and connectionReplaced (440) loops happened.
    if (connecting) {
        console.log('\x1b[33m[CONNECTION] Connect already in progress — duplicate request ignored.\x1b[0m');
        return sock;
    }
    connecting = true;

    // Cancel any pending backoff timer; this request supersedes it.
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

    // Start the REST API control layer (once per process)
    ensureApiServer();

    // Report lifecycle to the control layer
    botState.setStatus('connecting');

    // 1. Run Self-Repair on startup (guarded: repair failures must never
    //    crash boot — ffmpeg/system checks are best-effort)
    try {
        selfRepair();
    } catch (err) {
        console.error('\x1b[33m[SYSTEM] Self-repair skipped (non-fatal):\x1b[0m', err && err.message ? err.message : err);
    }

    // 2. Ensure session directory exists
    await fs.ensureDir(SESSION_DIR);

    // 3. Load Auth State (guarded: a failure here must schedule a retry,
    //    never become an unhandled rejection or kill the process)
    let state;
    try {
        state = (await useMultiFileAuthState(SESSION_DIR)).state;
    } catch (err) {
        console.error('\x1b[31m[CONNECTION] Failed to load auth state:\x1b[0m', err && err.message ? err.message : err);
        scheduleReconnect(null, 'auth_state_error', err);
        return null;
    }

    // Baileys falls back to its bundled version internally when the check
    // fails; guard anyway so an offline host cannot throw here.
    let version;
    let isLatest = false;
    try {
        ({ version, isLatest } = await fetchLatestBaileysVersion());
    } catch { /* Baileys default version is used */ }
    
    console.log(`\x1b[36m[SYSTEM] Using Baileys v${version.join('.')} (Latest: ${isLatest})\x1b[0m`);

    // 4. Load Commands once
    if (commands.size === 0) {
        commands = loadCommands();
    }

    // 5. Auth Preference (Pairing vs QR)
    // The CLI (edbots start / edbots pair) sets EDBOTS_AUTH_MODE and skips
    // its own interactive prompt to avoid asking the user twice.
    // If the env var is not set (legacy `node index.js` run), fall back to the
    // interactive prompt on TTY, or QR mode on headless systems.
    let usePairingCode = false;
    let phoneNumber = "";

    const cliAuthMode = process.env.EDBOTS_AUTH_MODE || '';
    const cliAuthHandled = cliAuthMode === 'qr' || cliAuthMode === 'pair';

    // Headless detection: no usable interactive stdin (cloud/VPS/Docker).
    // config.js webPairing.publicUrl also forces web pairing for servers
    // with a degraded TTY. .env is deliberately not involved here.
    let cfgWebPairing = {};
    try {
        cfgWebPairing = require('../config').webPairing || {};
    } catch {
        cfgWebPairing = {};
    }
    const headless = cfgWebPairing.publicUrl || !process.stdin.isTTY || !process.stdout.isTTY;

    if (cliAuthHandled) {
        // CLI already handled the selection — honor it silently
        if (cliAuthMode === 'pair') {
            usePairingCode = true;
            phoneNumber = (process.env.EDBOTS_PHONE_NUMBER || '').replace(/[^0-9]/g, '');
            if (!phoneNumber) {
                console.log('\x1b[31m[AUTH] CLI requested pairing mode but no phone number was set. Defaulting to QR Code.\x1b[0m');
                usePairingCode = false;
            }
        }
    } else if (headless && !state.creds.me && !state.creds.registered) {
        // Headless/cloud AND no usable session: the web pairing interface
        // owns first-time auth. QR arrives via the normal Baileys 'qr'
        // event and streams to the browser over SSE; pairing codes are
        // requested from the web UI. (With an existing session this branch
        // is skipped and the bot connects silently — no pairing URL.)
        authEvents.setState('WAITING_FOR_AUTH');
        printWebPairingBanner();

        // Create/refresh the pairing token (printed once to this console —
        // the owner pastes it into /pair to unlock the sensitive UI).
        try {
            const tokenStore = require('../api/webpair/tokenStore');
            const plaintext = tokenStore.ensure();
            if (plaintext) {
                console.log('');
                console.log('\x1b[33m  Pairing token (paste into the browser when asked):\x1b[0m');
                console.log(`\x1b[1m\x1b[32m  ${plaintext}\x1b[0m`);
                console.log('');
            }
        } catch (err) {
            console.log('\x1b[33m[AUTH] Pairing token unavailable:', (err && err.message) || err, '\x1b[0m');
        }
    } else if (!state.creds.me && !state.creds.registered) {
        if (process.stdin.isTTY) {
            console.log('\n\x1b[1m\x1b[33mSelect Authentication Method:\x1b[0m');
            console.log('1. QR Code (Default)');
            console.log('2. Pairing Code (Phone Number)');
            
            const choice = await question('Enter choice [1/2]: ');
            
            if (choice === '2') {
                usePairingCode = true;
                phoneNumber = await question('Enter your phone number (e.g., 2348012345678): ');
                phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
                
                if (!phoneNumber) {
                    console.log('\x1b[31m[ERROR] Invalid phone number. Defaulting to QR Code.\x1b[0m');
                    usePairingCode = false;
                }
            }
        }
    }

    // Reset per-attempt pairing state
    pairingRequested = false;
    pairingFailed = false;

    // 6. Socket Configuration
    sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        retryRequestDelayMs: 2000,
    });

    // Capture THIS attempt's socket. Handlers below close over it, so a late
    // event from an old socket can never mutate the new connection's state.
    const thisSock = sock;

    // Register with the control layer immediately so web pairing (/pair
    // request-code) can see the socket while it is still connecting.
    if (sock === thisSock) botState.setSocket(thisSock);

    // 7. Connection Logic — one listener per socket attempt. The async body
    // is isolated in handleConnectionUpdate with an explicit .catch(), so a
    // throw can never surface as an unhandled rejection (it used to).
    thisSock.ev.on('connection.update', (update) => {
        handleConnectionUpdate(update).catch((err) => {
            console.error('\x1b[31m[CONNECTION] connection.update handler error:\x1b[0m', err && err.message ? err.message : err);
        });
    });

    async function handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update;

        // Expose the live socket to the control layer — but only while it is
        // still the current socket. A stale socket's events must never
        // overwrite a newer connection's state.
        if (sock === thisSock) botState.setSocket(thisSock);

        // ── Authentication ─────────────────────────────────────
        // The `qr` event fires only when the WebSocket is connected and
        // ready — this is the reliable moment to request a pairing code.
        // Requesting it earlier races against the socket handshake and
        // fails silently, which is why the code never showed before.
        if (qr) {
            // Ignore QR events from a stale socket (e.g. an event that arrived
            // late, after a reconnect already replaced this attempt).
            if (sock !== thisSock) return;

            // Publish every QR WhatsApp issues to the web UI (SSE). It is
            // rendered to a PNG data-URL — the raw QR string stays on the
            // server and never crosses the wire.
            authEvents.setQr(qr);

            // Web-initiated pairing: botState holds a number queued by the
            // browser. This qr event is the safe moment to call WhatsApp —
            // requesting earlier races the socket handshake and fails.
            const webNumber = botState.consumeWebPairingNumber();
            if (webNumber && !pairingRequested) {
                pairingRequested = true;
                try {
                    console.log(`\x1b[33m[AUTH] Web pairing: requesting pairing code for ${webNumber}...\x1b[0m`);
                    const code = await thisSock.requestPairingCode(webNumber);
                    authEvents.setPairingCode(code);
                    pairingFailed = false;
                } catch (err) {
                    pairingFailed = true;
                    console.error('\x1b[31m[AUTH] Web pairing code request failed:\x1b[0m', err && err.message ? err.message : err);
                    botState.setWebPairingError(err && err.message ? err.message : 'pairing failed');
                }
                return; // next qr event (or a fresh attempt) re-evaluates
            }

            if (usePairingCode && !pairingRequested) {
                pairingRequested = true;
                try {
                    console.log(`\x1b[33m[AUTH] Requesting pairing code for ${phoneNumber}...\x1b[0m`);
                    const code = await thisSock.requestPairingCode(phoneNumber);
                    showPairingCode(code);
                } catch (err) {
                    pairingFailed = true;
                    console.error('\x1b[31m[AUTH] Failed to request pairing code:\x1b[0m', err.message);
                    console.log('\x1b[33m[AUTH] Falling back to QR Code — scan below:\x1b[0m');
                    qrcode.generate(qr, { small: true });
                }
            } else if (headless) {
                // Web pairing owns the UI: the QR lives in the browser at
                // /pair (streamed via SSE). Never print it in this terminal.
                console.log('\x1b[36m[AUTH] QR code ready — open the Web Authentication URL above to scan it.\x1b[0m');
            } else if (!usePairingCode || pairingFailed) {
                console.log('\x1b[36m[AUTH] Scan the QR Code below (WhatsApp → Linked Devices):\x1b[0m');
                qrcode.generate(qr, { small: true });
            }
        }

        // ── Closed / reconnect ─────────────────────────────────
        if (connection === 'close') {
            // A stale socket closing must not trigger reconnection logic for
            // the current connection (this is what used to double-connect).
            if (sock !== thisSock) return;
            const error = lastDisconnect?.error;
            const statusCode = new Boom(error)?.output?.statusCode;
            const reasonName =
                Object.keys(DisconnectReason).find((k) => DisconnectReason[k] === statusCode) ||
                (error && error.output && error.output.payload && error.output.payload.error) ||
                'unknown';

            // 401 loggedOut / 403 forbidden are PERMANENT: the session itself
            // was rejected. Everything else (428 connectionClosed, 408 timed
            // out/lost, 440 replaced, 500 badSession, 503 unavailable, 515
            // restartRequired…) is temporary and recovers with the EXISTING
            // session — no new QR, no logout, no session deletion.
            const isPermanent =
                statusCode === DisconnectReason.loggedOut ||
                statusCode === DisconnectReason.forbidden;

            // Mark this socket unavailable IMMEDIATELY. Commands, presence
            // updates and API consumers consult botState — from this moment
            // they fail fast instead of firing requests into a dead socket.
            if (sock === thisSock) botState.clearSocket(thisSock);
            botState.setStatus('offline', {
                reason: reasonName !== 'unknown' ? reasonName : (error?.message || 'connection_closed')
            });

            // Web pairing UI classification (unchanged semantics):
            // permanent → LOGGED_OUT screen; first temporary drop of a cycle
            // → FAILED banner while reconnection continues below.
            if (isPermanent) {
                authEvents.setState('LOGGED_OUT');
            } else if (reconnectAttempts === 0 && !botState.isStopped()) {
                authEvents.setState('FAILED', { reason: (error && error.message) || 'connection_closed' });
            }

            // API-requested stop: do NOT reconnect (session stays intact)
            if (botState.isStopped()) {
                console.log('\x1b[33m[CONNECTION] Stopped via API. Reconnect suppressed.\x1b[0m');
                connecting = false;
                return;
            }

            // Detailed, honest diagnostics for every disconnect.
            console.warn('\x1b[33m[CONNECTION] Socket closed.\x1b[0m');
            console.warn(`  state         : ${botState.getSnapshot().status}`);
            console.warn(`  statusCode    : ${statusCode !== undefined && statusCode !== null ? statusCode : 'n/a'}`);
            console.warn(`  reason        : ${reasonName}${error && error.message ? ` (${error.message})` : ''}`);
            console.warn(`  permanent     : ${isPermanent}`);
            console.warn(`  attempt       : ${reconnectAttempts + 1}`);

            if (isPermanent) {
                // Automatic reconnect cannot fix a rejected session. Stop the
                // reconnect loop (no process.exit — PM2 is for real crashes).
                reconnectAttempts = 0;
                connecting = false;
                console.error('\x1b[31m[CONNECTION] Session logged out / rejected by WhatsApp (re-pairing required).\x1b[0m');
                console.log('\x1b[36m[CONNECTION] Open the Web Authentication URL (/pair) or run: edbots pair\x1b[0m');

                // Genuine loggedOut only: archive the dead session so the next
                // start presents fresh pairing instead of failing forever.
                try {
                    const cleaned = await handleAuthFailure(error, SESSION_DIR);
                    if (cleaned) {
                        console.log('\x1b[33m[CONNECTION] Invalid session archived. Restarting to show fresh pairing…\x1b[0m');
                        reconnectAttempts = 0;
                        if (reconnectTimer) clearTimeout(reconnectTimer);
                        reconnectTimer = setTimeout(() => {
                            reconnectTimer = null;
                            connectToWhatsApp().catch((err) => {
                                console.error('[CONNECTION] Restart after session cleanup failed:', err && err.message ? err.message : err);
                            });
                        }, 2000);
                    }
                } catch (err) {
                    console.error('[CONNECTION] Session cleanup error:', err && err.message ? err.message : err);
                }
                return;
            }

            // Temporary failure → schedule ONE controlled reconnect with
            // exponential backoff (single-flight, same session, no QR).
            scheduleReconnect(statusCode, reasonName, error);
            return;
        }

        // ── Open ───────────────────────────────────────────────
        if (connection === 'open') {
            // Connected: cancel any pending reconnect, reset attempts, and
            // release the single-flight lock.
            if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
            reconnectAttempts = 0;
            connecting = false;

            // Race guard: the API may have requested a stop while we were
            // connecting. Honor it instead of flapping back online.
            if (botState.isStopped()) {
                console.log('\x1b[33m[CONNECTION] Connected, but a stop was requested — closing socket.\x1b[0m');
                try { thisSock.end(new Error('Stopped by EDBOTS API')); } catch { /* already closed */ }
                return;
            }

            console.log('\n\x1b[1m\x1b[32m[SUCCESS] EDBots Connected Successfully!\x1b[0m');
            console.log(`\x1b[36m[INFO] User: ${thisSock.user?.name || 'Bot'} (${thisSock.user?.id?.split(':')[0] || 'unknown'})\x1b[0m\n`);

            // Expose the live socket + status to the control layer
            botState.setSocket(thisSock);
            botState.setStatus('online');

            // Auth complete: publish CONNECTED, which also clears any QR/
            // pairing code still on screen and lets tokenStore consume the
            // pairing token (done in webpair/routes on state change).
            authEvents.setState('CONNECTED');
        }
    }

    // 8. Credential Saving - Patched for atomic safety (guarded: a failed
    //    write during a disconnect must never become an unhandled rejection)
    thisSock.ev.on('creds.update', async () => {
        try {
            await safeWriteAuth(path.join(SESSION_DIR, 'creds.json'), thisSock.authState.creds);
        } catch (err) {
            console.error('[CONNECTION] creds.json write failed:', err && err.message ? err.message : err);
        }
    });

    // 9. Message Handling (fully wrapped: event-handler throws would
    //    otherwise surface as unhandled rejections in Baileys' EventEmitter)
    thisSock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            if (!chatUpdate.messages || chatUpdate.messages.length === 0) return;
            const msg = chatUpdate.messages[0];
            if (!msg.message) return;
            if (msg.key.remoteJid === 'status@broadcast') return;

            await handleMessage(thisSock, msg, commands);

        } catch (err) {
            console.error('\x1b[31m[HANDLER ERROR]\x1b[0m', err);
        }
    });

    return sock;
};

module.exports = { connectToWhatsApp };
