/**
 * @file core/authEvents.js
 * @description Single source of truth for the WhatsApp authentication state.
 *
 * core/connection.js (the ONLY Baileys integration) reports real connection
 * events here: QR codes received from WhatsApp, pairing codes returned by
 * requestPairingCode(), connection open/close, and logged-out sessions.
 *
 * Consumers (the web pairing interface) subscribe and receive:
 * - an initial snapshot on subscribe
 * - live updates as Server-Sent Events
 *
 * Design rules:
 * - State is derived from actual Baileys events, never assumed.
 * - Secrets are NEVER stored in the clear: the QR is rendered to a PNG
 *   data-URL for display only; pairing codes are held briefly (they are
 *   short-lived by nature) and only served through token-authenticated
 *   endpoints. Nothing here is exposed on unauthenticated routes.
 * - The hub never touches the socket — connection.js stays in control.
 */

const QRCode = require('qrcode');

/** Valid states exposed to the UI. */
const STATES = [
    'INITIALIZING',
    'WAITING_FOR_AUTH',
    'QR_READY',
    'PAIRING_CODE_REQUESTED',
    'CONNECTING',
    'CONNECTED',
    'FAILED',
    'LOGGED_OUT'
];

// WhatsApp pairing codes are valid for roughly a minute; keep them a little
// longer so a slow reader can still use the displayed code, then drop them.
const PAIRING_CODE_TTL_MS = 120000;

let state = 'INITIALIZING';
let failureReason = null;

let qrImage = null; // PNG data-URL of the latest WhatsApp QR (display only)
let qrUpdatedAt = 0;

let pairingCode = null; // formatted "XXXX-XXXX"
let pairingCodeAt = 0;
let pairingCodeExpiresAt = 0;

// Set when a web-initiated pairing attempt fails, allowing the next QR event
// to retry without needing a full reconnect cycle.
let webPairingRetry = false;

/** Live SSE response objects. */
const listeners = new Set();

const nowIso = () => new Date().toISOString();

function formatCode(code) {
    return (String(code || '').match(/.{1,4}/g) || []).join('-');
}

/**
 * Push an event to every connected browser. Write failures (closed tabs,
 * dead proxies) silently drop the listener.
 */
function publish(payload) {
    const frame = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of listeners) {
        try {
            res.write(frame);
        } catch {
            listeners.delete(res);
        }
    }
}

/**
 * Transition the auth state. Same-state transitions are ignored (except by
 * the dedicated setQr/setPairingCode helpers which always publish payloads).
 */
function setState(next, details = {}) {
    if (!STATES.includes(next)) return;
    if (state === next) return;

    state = next;
    if (details.reason !== undefined) failureReason = String(details.reason);

    if (next === 'CONNECTED') {
        // Auth succeeded: drop short-lived secrets immediately.
        qrImage = null;
        pairingCode = null;
        failureReason = null;
        webPairingRetry = false;
    }
    if (next === 'WAITING_FOR_AUTH') {
        qrImage = null;
        pairingCode = null;
        failureReason = null;
    }
    if (next === 'LOGGED_OUT') {
        qrImage = null;
        pairingCode = null;
    }

    publish({ type: 'state', state, reason: failureReason || undefined, timestamp: nowIso() });
}

/**
 * A new QR code arrived from WhatsApp. Render it to a data-URL and publish.
 * (The raw QR string is never broadcast — only the rendered image.)
 */
function setQr(qrString) {
    if (!qrString) return;
    state = 'QR_READY';
    failureReason = null;
    qrUpdatedAt = Date.now();

    publish({ type: 'state', state: 'QR_READY', timestamp: nowIso() });

    QRCode.toDataURL(qrString, {
        margin: 1,
        width: 360,
        color: { dark: '#0f172a', light: '#ffffff' }
    })
        .then((dataUrl) => {
            qrImage = dataUrl;
            publish({ type: 'qr', state: 'QR_READY', qrImage, timestamp: nowIso() });
        })
        .catch((err) => {
            console.error('[AUTH] Failed to render QR image:', err && err.message ? err.message : err);
            qrImage = null;
            publish({ type: 'qr', state: 'QR_READY', qrImage: null, timestamp: nowIso() });
        });
}

/**
 * A pairing code was returned by WhatsApp (sock.requestPairingCode).
 */
function setPairingCode(code) {
    if (!code) return;
    state = 'PAIRING_CODE_REQUESTED';
    pairingCode = formatCode(code);
    pairingCodeAt = Date.now();
    pairingCodeExpiresAt = pairingCodeAt + PAIRING_CODE_TTL_MS;
    webPairingRetry = false;
    failureReason = null;

    publish({
        type: 'pairing_code',
        state: 'PAIRING_CODE_REQUESTED',
        code: pairingCode,
        expiresAt: new Date(pairingCodeExpiresAt).toISOString(),
        timestamp: nowIso()
    });
}

/** A web-initiated pairing attempt failed; allow retry on the next QR event. */
function markPairingFailed(reason) {
    pairingCode = null;
    pairingCodeExpiresAt = 0;
    webPairingRetry = true;
    setState('FAILED', { reason: reason || 'pairing_code_failed' });
}

/** Is a recently-issued pairing code still on screen? */
function hasRecentPairing() {
    return !!(pairingCode && Date.now() < pairingCodeExpiresAt);
}

/** Whether the next QR event should retry a failed web pairing request. */
function needsWebPairingRetry() {
    return webPairingRetry;
}

/** A pairing code was consumed successfully (or the attempt moved on). */
function clearPairingCode() {
    pairingCode = null;
    pairingCodeExpiresAt = 0;
}

/**
 * Token-safe snapshot for authenticated web endpoints.
 * Contains NO WhatsApp credentials, session keys, or raw QR strings.
 */
function getSnapshot() {
    return {
        state,
        qrImage: state === 'QR_READY' ? qrImage : null,
        qrUpdatedAt: qrUpdatedAt ? new Date(qrUpdatedAt).toISOString() : null,
        pairingCode: hasRecentPairing() ? pairingCode : null,
        pairingCodeExpiresAt: pairingCodeExpiresAt
            ? new Date(pairingCodeExpiresAt).toISOString()
            : null,
        failureReason: state === 'FAILED' ? failureReason : null
    };
}

function getState() {
    return state;
}

/**
 * Subscribe an SSE response. Sends an immediate snapshot frame so a freshly
 * opened page renders the current state without waiting for the next event.
 * Returns an unsubscribe function.
 */
function subscribe(res) {
    const frame = `data: ${JSON.stringify({ type: 'snapshot', ...getSnapshot(), timestamp: nowIso() })}\n\n`;
    res.write(frame);
    listeners.add(res);
    return () => listeners.delete(res);
}

function subscriberCount() {
    return listeners.size;
}

module.exports = {
    STATES,
    PAIRING_CODE_TTL_MS,
    setState,
    setQr,
    setPairingCode,
    markPairingFailed,
    hasRecentPairing,
    needsWebPairingRetry,
    clearPairingCode,
    getSnapshot,
    getState,
    subscribe,
    subscriberCount
};
