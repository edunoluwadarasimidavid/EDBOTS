/**
 * @file connection.js
 * @description Hardened WhatsApp connection engine with generation-based
 * socket identity, single-flight reconnects, and session safety.
 *
 * Lifecycle guarantees:
 * - Exactly ONE active Baileys socket per process (single-flight `connecting`
 *   lock + cross-process session lockfile).
 * - Every socket carries a generation (`__connGen`, owned by botState).
 *   Event handlers verify the event belongs to the CURRENT generation before
 *   doing any work — stale sockets can never process messages, send replies,
 *   update presence, write credentials, or trigger reconnection.
 * - Before a replacement socket is created, the old one is RETIRED: its
 *   listeners are removed first, then the socket is ended — so no late event
 *   from a dead socket can ever fire application handlers again.
 * - Disconnect reasons come from the real Baileys DisconnectReason codes.
 *   401/403 are permanent (stop, require re-pairing); everything else
 *   (428/408/440/500/503/515…) reconnects with the existing session using
 *   controlled exponential backoff — connectionReplaced (440) gets its own
 *   escalation curve, restartRequired (515) reconnects fast.
 * - Never process.exit() for connection problems: PM2 only handles crashes.
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
// botState owns the authoritative socket generation.
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

// ── Connection manager state (the ONE authoritative copy) ────────────────
let sock = null;             // current RAW socket (identity in botState)
let reconnectAttempts = 0;   // consecutive reconnects without a stable open
let commands = new Map();
let connecting = false;      // single-flight lock (connect OR reconnect)
let reconnectTimer = null;   // pending backoff timer (cancellable)

// Connection generation of the socket being created (diagnostics/logging).
let connectionGeneration = 0;

// When the current connection successfully opened (stability window).
let currentConnectionStartedAt = 0;
const STABLE_CONNECTION_MS = 10000;   // open for >=10s counts as stable

// connectionReplaced (440) escalation tracking.
let replacedCount = 0;
let lastReplacedAt = 0;

// Rate-limited stale-event logging (avoid console spam during flaps).
let lastStaleEventLogAt = 0;
const STALE_LOG_INTERVAL_MS = 30000;

// Pairing-code state (reset per connection attempt)
let pairingRequested = false;
let pairingFailed = false;

// Logger setup
const logger = pino({ level: 'silent' });

// Session path
const SESSION_DIR = path.join(__dirname, '..', config.sessionName || 'session');

// Cross-process session lockfile: prevents two OS processes (e.g. PM2
// instance + manual `node index.js`, or the CLI) from both opening the same
// WhatsApp session — the #1 real-world cause of 440 connectionReplaced.
const LOCK_FILE = path.join(SESSION_DIR, '.connection.lock');
let exitHookRegistered = false;

/**
 * Try to acquire the session lock. Returns { ok, holder? }.
 * A lock held by a DEAD pid is treated as stale and removed. Lock errors
 * never block boot (the lock is a safety net, not a hard dependency).
 */
function acquireSessionLock() {
    try {
        fs.ensureDirSync(SESSION_DIR);
        if (fs.existsSync(LOCK_FILE)) {
            let info = null;
            try { info = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')); } catch { info = null; }
            if (info && info.pid && info.pid !== process.pid) {
                try {
                    process.kill(info.pid, 0); // throws if the holder is dead
                    return { ok: false, holder: info };
                } catch { /* holder is gone — stale lock */ }
            }
            fs.removeSync(LOCK_FILE);
        }
        fs.writeJsonSync(LOCK_FILE, { pid: process.pid, startedAt: new Date().toISOString() });
        return { ok: true };
    } catch (err) {
        return { ok: true, warn: err.message };
    }
}

/** Release the session lock if we own it (sync — safe in 'exit' handler). */
function releaseSessionLock() {
    try {
        if (fs.existsSync(LOCK_FILE)) {
            let info = null;
            try { info = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')); } catch { info = null; }
            if (!info || info.pid === process.pid) fs.removeSync(LOCK_FILE);
        }
    } catch { /* best effort */ }
}

/**
 * Retire a socket: mark it stale, strip ALL its event listeners, then end
 * it. Removing listeners BEFORE end() guarantees the close event cannot re-
 * enter application handlers (the race behind duplicate reconnects).
 */
const retireSocket = (oldSock, cause) => {
    if (!oldSock) return;
    try {
        oldSock.__stale = true;
        if (oldSock.ev && typeof oldSock.ev.removeAllListeners === 'function') {
            oldSock.ev.removeAllListeners();
        }
    } catch { /* emitter already gone */ }
    try {
        if (oldSock.ws && oldSock.ws.readyState === 1) {
            oldSock.end(new Error(cause || 'Socket replaced by EDBOTS'));
        }
    } catch { /* already closed */ }
    if (sock === oldSock) sock = null;
    console.log(`\x1b[2m[CONNECTION] Retired socket generation ${oldSock.__connGen ?? 'n/a'} (${cause || 'replaced'}). listeners removed, socket closed\x1b[0m`);
};

/**
 * Log a stale-socket event at most once per STALE_LOG_INTERVAL_MS.
 */
const logStaleEvent = (what, staleGen) => {
    const now = Date.now();
    if (now - lastStaleEventLogAt < STALE_LOG_INTERVAL_MS) return;
    lastStaleEventLogAt = now;
    console.log(`\x1b[33m[CONNECTION] Ignoring stale socket event (${what}) from generation ${staleGen ?? 'n/a'} — current generation is ${botState.getGeneration()}.\x1b[0m`);
};

/**
 * Is this socket still the current, authoritative one?
 */
const isCurrentSocket = (thisSock) =>
    thisSock && sock === thisSock && !thisSock.__stale &&
    thisSock.__connGen === botState.getGeneration();

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
 * Schedule exactly ONE reconnect attempt after a controlled backoff.
 *
 * - Single-flight: the timer is stored globally; a newer connect request
 *   cancels it. connectToWhatsApp() re-acquires the lock on entry, so the
 *   scheduled attempt can never race another one.
 * - restartRequired (515): fast 2s reconnect (WhatsApp asked for it).
 * - connectionReplaced (440): separate escalation curve (5s→60s) with a
 *   clear diagnostic that a competing client/process is the likely cause.
 * - Everything else: exponential 1s→30s. The attempt counter is reset by
 *   the close handler after a STABLE connection, so repeated network blips
 *   escalate but a healthy session always restarts the curve at 1s.
 * - Never gives up and never exits the process: PM2 only handles crashes.
 */
const scheduleReconnect = (statusCode, reasonName) => {
    reconnectAttempts++;

    let delayMs;
    if (statusCode === DisconnectReason.restartRequired) {
        // WhatsApp itself asked for an immediate reconnect with the SAME
        // session — keep it quick, it is not a failure loop.
        delayMs = 2000;
    } else if (statusCode === DisconnectReason.connectionReplaced) {
        // Escalating backoff for 440 conflicts (5s, 10s, 20s, 40s, 60s…).
        replacedCount++;
        delayMs = Math.min(5000 * Math.pow(2, replacedCount - 1), 60000);
        if (replacedCount === 1) {
            console.warn('\x1b[33m[CONNECTION] connectionReplaced (440): another client/session took over this WhatsApp session.\x1b[0m');
            console.warn('\x1b[33m  Usual causes: a second EDBOTS process (PM2 instance + manual start / CLI / another server),\x1b[0m');
            console.warn('\x1b[33m  or the same number linked elsewhere. EDBOTS itself only ever creates ONE socket.\x1b[0m');
        } else if (replacedCount >= 3) {
            console.warn(`\x1b[33m[CONNECTION] Repeated 440 conflicts (${replacedCount}). Check: pm2 ls for duplicate instances, another host using this session, or Linked Devices on the phone.\x1b[0m`);
        }
    } else {
        delayMs = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
    }

    console.warn(`  willReconnect : true (temporary failure)`);
    console.warn(`  nextRetryIn   : ${Math.round(delayMs / 1000)}s`);
    if (reconnectAttempts % 10 === 0) {
        console.log('\x1b[36m[CONNECTION] Still retrying — check network/DNS. Tip: edbots doctor\x1b[0m');
    }
    void reasonName; // already logged by the caller

    // The current pipeline ends here; release the single-flight lock so the
    // scheduled attempt may run (it re-acquires the lock on entry).
    connecting = false;

    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectToWhatsApp().catch((err) => {
            console.error('[CONNECTION] Reconnect attempt error:', err && err.message ? err.message : err);
            connecting = false;
            scheduleReconnect(null, 'reconnect_error');
        });
    }, delayMs);
};

/**
 * Main Connection Function — the single authoritative connection manager.
 * Boot (index.js), the CLI, and POST /api/bot/start all funnel through here;
 * the single-flight lock and generation system make duplicates impossible.
 */
const connectToWhatsApp = async () => {
    // Single-flight guard: never allow two connect pipelines (boot, API
    // start, scheduled reconnect) to run concurrently.
    if (connecting) {
        console.log('\x1b[33m[CONNECTION] Connect already in progress — duplicate request ignored.\x1b[0m');
        return sock;
    }

    // API-requested stop: do not create sockets while stopped.
    if (botState.isStopped()) {
        console.log('\x1b[33m[CONNECTION] Bot is stopped via API — connect suppressed.\x1b[0m');
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

    // 1.5 Cross-process session lock: another OS process holding this
    //     session would cause 440 connectionReplaced wars. Refuse to add a
    //     second connection instead of fighting over the session.
    const lock = acquireSessionLock();
    if (!lock.ok) {
        connecting = false;
        console.error('\x1b[31m[CONNECTION] Another EDBOTS process already owns this WhatsApp session.\x1b[0m');
        console.error(`\x1b[31m  Holder pid: ${lock.holder.pid}, started: ${lock.holder.startedAt}\x1b[0m`);
        console.error('\x1b[31m  Running two bots on one session causes 440 connectionReplaced conflicts.\x1b[0m');
        console.error('\x1b[31m  Stop the other process first (pm2 ls / edbots restart), then start this one.\x1b[0m');
        return null;
    }
    if (lock.warn) {
        console.warn(`\x1b[33m[CONNECTION] Session lock unavailable (${lock.warn}) — continuing without cross-process guard.\x1b[0m`);
    }
    if (!exitHookRegistered) {
        exitHookRegistered = true;
        process.on('exit', releaseSessionLock);
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
        scheduleReconnect(null, 'auth_state_error');
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

    // 6. RETIRE the old socket BEFORE creating the replacement: strip its
    //    listeners (so its late close cannot re-enter our handlers), end it,
    //    and invalidate its identity via the new generation below.
    retireSocket(sock, 'replaced by new connection');

    connectionGeneration = botState.getGeneration() + 1;
    console.log(`[CONNECTION] Creating socket generation ${connectionGeneration}...`);

    // 7. Socket Configuration
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

    // Capture THIS attempt's socket. Handlers below close over it and verify
    // the generation before doing anything — a stale socket's events can
    // never process messages, reply, update presence, or reconnect.
    const thisSock = sock;

    // Register with the control layer: assigns THIS socket its generation
    // (== connectionGeneration) and hands out a guarded proxy to consumers.
    // Registering also immediately invalidates every previous socket.
    if (sock === thisSock) botState.setSocket(thisSock);

    // 8. Connection Logic — one listener per socket attempt. The async body
    // is isolated in handleConnectionUpdate with an explicit .catch(), so a
    // throw can never surface as an unhandled rejection.
    thisSock.ev.on('connection.update', (update) => {
        handleConnectionUpdate(update).catch((err) => {
            console.error('\x1b[31m[CONNECTION] connection.update handler error:\x1b[0m', err && err.message ? err.message : err);
        });
    });

    async function handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update;

        // STALE-SOCKET GUARD (generation check). An old socket's events must
        // not touch the connection state, auth UI, or reconnection logic.
        if (!isCurrentSocket(thisSock)) {
            logStaleEvent('connection.update', thisSock.__connGen);
            return;
        }

        // ── Authentication ─────────────────────────────────────
        // The `qr` event fires only when the WebSocket is connected and
        // ready — this is the reliable moment to request a pairing code.
        // Requesting it earlier races against the socket handshake and
        // fails silently, which is why the code never showed before.
        if (qr) {
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
            const error = lastDisconnect?.error;
            // Baileys raises @hapi/boom errors: read the code straight from
            // the error's own output first; re-wrapping stays as a fallback
            // for plain Errors carrying { statusCode }. Never guess by
            // string matching.
            const statusCode =
                (error && error.output && error.output.statusCode) ??
                new Boom(error)?.output?.statusCode;
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

            // Mark this socket unavailable IMMEDIATELY. Consumers (handler,
            // anti-ban, API) consult botState — from this moment they fail
            // fast instead of firing requests into a dead socket.
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

            // API-requested stop: do NOT reconnect (session stays intact).
            // Retire the socket so no listener can fire afterwards.
            if (botState.isStopped()) {
                console.log('\x1b[33m[CONNECTION] Stopped via API. Reconnect suppressed.\x1b[0m');
                retireSocket(thisSock, 'stopped via API');
                connecting = false;
                return;
            }

            // A connection that stayed open for >= STABLE_CONNECTION_MS was
            // healthy: restart the backoff curves from the beginning.
            const wasStable = currentConnectionStartedAt > 0 &&
                (Date.now() - currentConnectionStartedAt) >= STABLE_CONNECTION_MS;
            if (wasStable) {
                reconnectAttempts = 0;
                replacedCount = 0;
            }

            // Detailed, honest diagnostics for every disconnect.
            console.warn('\x1b[33m[CONNECTION] Socket closed.\x1b[0m');
            console.warn(`  generation    : ${thisSock.__connGen ?? 'n/a'}`);
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
                retireSocket(thisSock, 'logged out');
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
            // Retire the dead socket FIRST: mark stale, strip its listeners
            // and drop the reference, so a duplicated/late close event from
            // this socket can never schedule a second reconnect.
            retireSocket(thisSock, reasonName);
            scheduleReconnect(statusCode, reasonName);
            return;
        }

        // ── Open ───────────────────────────────────────────────
        if (connection === 'open') {
            // Connected: cancel any pending reconnect, mark the connection
            // start (stability window), release the single-flight lock.
            if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
            currentConnectionStartedAt = Date.now();
            connecting = false;

            // Race guard: the API may have requested a stop while we were
            // connecting. Honor it instead of flapping back online.
            if (botState.isStopped()) {
                console.log('\x1b[33m[CONNECTION] Connected, but a stop was requested — closing socket.\x1b[0m');
                retireSocket(thisSock, 'stopped via API');
                botState.setStatus('offline', { reason: 'stopped_by_api' });
                return;
            }

            console.log('\n\x1b[1m\x1b[32m[SUCCESS] EDBots Connected Successfully!\x1b[0m');
            console.log(`\x1b[36m[INFO] User: ${thisSock.user?.name || 'Bot'} (${thisSock.user?.id?.split(':')[0] || 'unknown'})  [generation ${thisSock.__connGen ?? 'n/a'}]\x1b[0m\n`);

            // Expose the live socket + status to the control layer. Only NOW
            // is message handling allowed: botState.isSocketOpen() requires
            // status 'online', which is set here — messages arriving before
            // this point are dropped as stale, never processed.
            botState.setSocket(thisSock);
            botState.setStatus('online');

            // Auth complete: publish CONNECTED, which also clears any QR/
            // pairing code still on screen and lets tokenStore consume the
            // pairing token (done in webpair/routes on state change).
            authEvents.setState('CONNECTED');
        }
    }

    // 9. Credential Saving — generation-gated: a stale socket must NEVER
    //    write outdated credentials over the current session's files.
    thisSock.ev.on('creds.update', async () => {
        if (!isCurrentSocket(thisSock)) {
            logStaleEvent('creds.update', thisSock.__connGen);
            return;
        }
        try {
            await safeWriteAuth(path.join(SESSION_DIR, 'creds.json'), thisSock.authState.creds);
        } catch (err) {
            console.error('[CONNECTION] creds.json write failed:', err && err.message ? err.message : err);
        }
    });

    // 10. Message Handling — generation + liveness gated. Messages arriving
    //     from a stale socket, while reconnecting, or before 'open' are
    //     dropped (rate-limited log), never processed and never queued.
    thisSock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            if (!isCurrentSocket(thisSock) || !botState.isSocketOpen(thisSock)) {
                logStaleEvent('message', thisSock.__connGen);
                console.log('\x1b[2m[HANDLER] Ignoring message from stale/closed socket.\x1b[0m');
                return;
            }

            if (!chatUpdate.messages || chatUpdate.messages.length === 0) return;
            const msg = chatUpdate.messages[0];
            if (!msg.message) return;
            if (msg.key.remoteJid === 'status@broadcast') return;

            // Hand the handler a GUARDED proxy: every send/presence call it
            // makes re-verifies liveness at call time and fails fast with a
            // catchable error if the connection died mid-processing.
            await handleMessage(botState.getSocket(), msg, commands);

        } catch (err) {
            console.error('\x1b[31m[HANDLER ERROR]\x1b[0m', err);
        }
    });

    return sock;
};

module.exports = { connectToWhatsApp };
