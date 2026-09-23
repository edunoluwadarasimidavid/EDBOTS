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
    getSnapshot
};
