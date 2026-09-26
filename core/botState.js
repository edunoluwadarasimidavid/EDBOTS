/**
 * @file botState.js
 * @description Runtime bridge between the WhatsApp connection engine and the
 * REST API control layer. Owns the authoritative socket identity.
 *
 * Design rules:
 * - Purely observational/control: it NEVER touches Baileys internals,
 *   session files, or message handling.
 * - connection.js reports lifecycle events here (additive).
 * - The API reads the snapshot and may request start/stop.
 *
 * Socket identity ("generation"): every socket registered via setSocket()
 * gets a monotonically increasing generation number, stamped onto the raw
 * socket as __connGen. Consumers that captured an older socket (handler,
 * commands, presence simulation, API) can be told apart from the current
 * one by that number, so a stale socket can never:
 *   - process messages,  - update presence,  - send replies,
 *   - write credentials, - overwrite the current reference, or
 *   - trigger a reconnect.
 *
 * Guarded socket: getSocket()/setSocket() hand out a Proxy around the raw
 * Baileys socket. Network operations invoked through the proxy fail FAST
 * with a clean, catchable "Connection Closed" error when that socket is
 * stale or not open — instead of hanging on / throwing out of a dead
 * WebSocket. Non-network properties (ev, ws, user, authState…) pass
 * through unchanged.
 *
 * "stop" semantics: we mark stopped=true and end the socket. connection.js
 * checks this flag in its close handler and deliberately does NOT reconnect.
 */

const state = {
    status: 'offline', // offline | connecting | online

    // Authoritative socket generation. Incremented on every setSocket() of a
    // NEW socket. Anything whose __connGen differs is stale by definition.
    generation: 0,

    // Web pairing: when the browser asks for a pairing code, this holds the
    // phone number until the next QR event, when connection.js calls
    // sock.requestPairingCode() (the only moment WhatsApp accepts it).
    webPairingNumber: null,
    webPairingError: null,
    stoppedByApi: false,
    startedAt: Date.now(),
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    lastDisconnectReason: null,
    lastError: null,
    user: null, // { id, name } when online
    sock: null  // RAW socket (proxies are handed out by getSocket())
};

function setStatus(status, details = {}) {
    state.status = status;
    if (details.user !== undefined) state.user = details.user;
    if (details.reason !== undefined) state.lastDisconnectReason = details.reason;
    if (details.error !== undefined) state.lastError = details.error;

    if (status === 'online') {
        state.lastConnectedAt = Date.now();
        state.lastError = null;
    }
    if (status === 'offline') {
        state.lastDisconnectedAt = Date.now();
    }
}

// ── Socket identity + guarded proxy ─────────────────────────────────────

/** Accepts a raw socket or a guarded proxy; returns the raw socket. */
function unwrapSock(s) {
    if (!s) return null;
    return s.__rawSock || s;
}

/**
 * Methods that touch the WhatsApp network. When invoked through the guarded
 * proxy on a stale/closed socket, they reject immediately with a clean
 * error instead of hanging or throwing from a dead WebSocket.
 */
const NETWORK_METHODS = new Set([
    'sendMessage', 'relayMessage', 'sendPresenceUpdate', 'readMessages',
    'presenceSubscribe', 'chatModify', 'groupMetadata', 'groupInviteCode',
    'groupToggleEphemeral', 'groupSettingUpdate', 'groupParticipantsUpdate',
    'groupLeave', 'profilePictureUrl', 'requestPairingCode',
    'newsletterFetchMessages', 'newsletterUpdateMetadata', 'storyRead',
    'fetchBusinessProfile', 'updateProfilePicture', 'updateProfileStatus',
    'updateProfileName', 'blockUser', 'updateBlockStatus'
]);

/**
 * Wrap a raw socket in a guarded proxy. The proxy is memoized on the raw
 * socket (__guarded) so identity stays stable across getSocket() calls.
 */
function makeGuardedSocket(raw) {
    if (raw.__guarded) return raw.__guarded;

    const wrappedCache = new Map();

    const proxy = new Proxy(raw, {
        get(target, prop) {
            if (prop === '__rawSock') return target;
            if (prop === '__connGen') return target.__connGen;

            const value = Reflect.get(target, prop, target);

            if (NETWORK_METHODS.has(prop) && typeof value === 'function') {
                if (!wrappedCache.has(prop)) {
                    wrappedCache.set(prop, function guardedNetworkMethod(...args) {
                        if (!isSocketOpen(raw)) {
                            const err = new Error('Connection Closed');
                            err.isStaleSocket = true;
                            console.warn(
                                `[SOCKET] ${String(prop)}() blocked — socket generation ` +
                                `${raw.__connGen} is stale or not open (status: ${state.status}).`
                            );
                            return Promise.reject(err);
                        }
                        return value.apply(target, args);
                    });
                }
                return wrappedCache.get(prop);
            }

            // Other functions: bind to the RAW socket so `this` is correct.
            if (typeof value === 'function') return value.bind(target);
            return value;
        }
    });

    raw.__guarded = proxy;
    return proxy;
}

/**
 * Register a socket as the current one. Assigns a NEW generation number to
 * every new socket (invalidating all previous ones). Calling it again with
 * the SAME socket (e.g. on connection 'open') only refreshes the identity.
 * Returns the guarded proxy for the socket.
 */
function setSocket(sock) {
    const raw = unwrapSock(sock);
    if (!raw) {
        state.sock = null;
        return null;
    }

    if (state.sock === raw) {
        // Same socket re-registered: refresh identity only, do NOT bump.
        if (raw.user) {
            state.user = { id: raw.user.id || null, name: raw.user.name || null };
        }
        return makeGuardedSocket(raw);
    }

    state.generation++;
    raw.__connGen = state.generation;
    state.sock = raw;
    state.user = raw.user
        ? { id: raw.user.id || null, name: raw.user.name || null }
        : null;
    return makeGuardedSocket(raw);
}

function isStopped() {
    return state.stoppedByApi;
}

/** Current generation number (diagnostics / stale-event logging). */
function getGeneration() {
    return state.generation;
}

/**
 * True only when the given (or the registered) socket is genuinely usable:
 * it is the CURRENT generation, the WebSocket is OPEN and the session is
 * authenticated (Baileys sets sock.user on open). Accepts a raw socket or
 * a guarded proxy. This is the single source of truth for "can I use this
 * socket right now?" — the handler, anti-ban simulation, and any other
 * caller must consult it instead of trusting stale references.
 */
function isSocketOpen(candidateSock = null) {
    const raw = unwrapSock(candidateSock) || state.sock;
    if (!raw) return false;
    if (raw.__connGen !== state.generation) return false; // stale identity
    return !!(
        state.status === 'online' &&
        raw.user &&
        raw.ws &&
        raw.ws.readyState === 1 // WebSocket.OPEN
    );
}

/**
 * Live socket as a guarded proxy (or null). Network calls through it fail
 * fast when the socket is stale/closed. Read-only consumers (e.g. the API's
 * group listing) also pass through unchanged properties like `user`.
 */
function getSocket() {
    return state.sock ? makeGuardedSocket(state.sock) : null;
}

/**
 * The current active socket proxy, but ONLY if it is genuinely usable.
 * Returns null when the connection is down/reconnecting, so callers can
 * distinguish "no socket" from "stale socket" and fail gracefully instead
 * of firing a doomed request at a dead WebSocket.
 */
function getActiveSocket() {
    return isSocketOpen() ? getSocket() : null;
}

/**
 * Drop the socket reference (on close/replace). Accepts a raw socket or a
 * guarded proxy; only clears when it matches the CURRENT socket (a stale
 * caller can never clear a newer connection's registration). The caller's
 * old socket stays stale forever because setSocket() bumped the generation
 * when the replacement was registered.
 */
function clearSocket(staleSock) {
    const stale = unwrapSock(staleSock);
    if (!stale || state.sock === stale) {
        state.sock = null;
    }
}

/**
 * True when an error means the connection is gone (not a command bug).
 * Used by the handler to give users a friendly "reconnecting" message
 * instead of a scary stack trace.
 */
function isConnectionError(err) {
    const msg = String((err && (err.message || err)) || '');
    return (
        msg === 'Connection Closed' ||
        msg === 'Connection Lost' ||
        msg === 'Timed Out' ||
        msg === 'Service Unavailable' ||
        msg === 'Precondition Required' ||
        msg === 'Forbidden' ||
        msg === 'Stream Errored (restart required)' ||
        msg === 'Connection Replaced' ||
        msg === 'Integrity check failed' ||
        /connection (closed|lost)|timed out|stream errored|service unavailable|websocket|closed/i.test(msg)
    );
}

/**
 * Request a stop: flag it, then close the socket gracefully.
 * connection.js sees the flag on close and skips reconnection.
 */
function requestStop() {
    state.stoppedByApi = true;
    if (state.sock) {
        try {
            state.sock.end(new Error('Stopped by EDBOTS API'));
        } catch (err) {
            console.error('[BotState] Error closing socket:', err.message);
        }
    }
    clearSocket();
    setStatus('offline', { reason: 'stopped_by_api' });
    return true;
}

/**
 * Clear the stop flag so the next connectToWhatsApp() call is allowed.
 */
function requestStart() {
    state.stoppedByApi = false;
    state.lastDisconnectReason = null;
    return true;
}

// ── Web pairing bridge ───────────────────────────────────────────────────

/**
 * Queue a pairing-code request from the web UI.
 * Returns { ok, status, code, message } for the HTTP response.
 */
function requestWebPairing(phoneNumber) {
    const authEvents = require('./authEvents');

    if (state.status === 'online') {
        return { ok: false, status: 409, code: 'ALREADY_CONNECTED', message: 'WhatsApp is already connected.' };
    }
    if (!state.sock) {
        return {
            ok: false,
            status: 503,
            code: 'SOCKET_NOT_READY',
            message: 'The WhatsApp socket is not ready yet. Wait a few seconds and try again.'
        }
    }
    if (authEvents.needsWebPairingRetry()) {
        // A previous attempt failed; clear the flag so the retry can proceed.
        authEvents.clearPairingCode();
    }
    state.webPairingNumber = String(phoneNumber || '').replace(/[^0-9]/g, '');
    authEvents.setState('CONNECTING');
    return { ok: true };
}

/** Number queued by the web UI, or null. Consumed by connection.js. */
function consumeWebPairingNumber() {
    const n = state.webPairingNumber || null;
    state.webPairingNumber = null;
    return n;
}

function setWebPairingError(message) {
    state.webPairingError = message || null;
    if (message) {
        require('./authEvents').markPairingFailed('pairing_code_failed');
    }
}

/**
 * Immutable-ish snapshot for the API layer.
 */
function getSnapshot() {
    return {
        status: state.status,
        connectionGeneration: state.generation,
        stoppedByApi: state.stoppedByApi,
        startedAt: new Date(state.startedAt).toISOString(),
        lastConnectedAt: state.lastConnectedAt
            ? new Date(state.lastConnectedAt).toISOString()
            : null,
        lastDisconnectedAt: state.lastDisconnectedAt
            ? new Date(state.lastDisconnectedAt).toISOString()
            : null,
        lastDisconnectReason: state.lastDisconnectReason,
        user: state.user
    };
}

module.exports = {
    setStatus,
    setSocket,
    isStopped,
    getGeneration,
    getSocket,
    getActiveSocket,
    isSocketOpen,
    clearSocket,
    isConnectionError,
    requestStop,
    requestStart,
    getSnapshot,
    requestWebPairing,
    consumeWebPairingNumber,
    setWebPairingError
};
