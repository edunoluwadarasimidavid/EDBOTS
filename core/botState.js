/**
 * @file botState.js
 * @description Runtime bridge between the WhatsApp connection engine and the
 * REST API control layer.
 *
 * Design rules:
 * - Purely observational/control: it NEVER touches Baileys internals,
 *   session files, or message handling.
 * - connection.js reports lifecycle events here (additive, ~6 lines).
 * - The API reads the snapshot and may request start/stop.
 *
 * "stop" semantics: we mark stopped=true and end the socket. connection.js
 * checks this flag in its close handler and deliberately does NOT reconnect,
 * which is the cleanest way to stop without touching the reconnect logic.
 */

const state = {
    status: 'offline', // offline | connecting | online

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
    sock: null
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

function setSocket(sock) {
    state.sock = sock || null;
    if (sock && sock.user) {
        state.user = {
            id: sock.user.id || null,
            name: sock.user.name || null
        };
    }
}

function isStopped() {
    return state.stoppedByApi;
}

/**
 * Live socket reference (or null). Read-only consumers only (e.g. the API's
 * group listing). Callers must NOT reconfigure or send messages casually.
 */
function getSocket() {
    return state.sock;
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
    getSocket,
    requestStop,
    requestStart,
    getSnapshot,
    requestWebPairing,
    consumeWebPairingNumber,
    setWebPairingError
};
