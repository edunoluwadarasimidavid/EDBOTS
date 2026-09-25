/**
 * @file api/webpair/config.js
 * @description Configuration for the web pairing interface (sensitive!).
 *
 * PUBLIC_URL decides what the terminal prints for the user. It is a
 * convenience for humans — the server binds 0.0.0.0:PORT regardless. The
 * page itself always works on whatever host the user actually opened.
 *
 * Token security model (see tokenStore.js):
 * - A cryptographically random token is generated on every boot when auth
 *   is pending. It is printed to the SERVER's log/terminal only.
 * - Tokens expire and are invalidated after successful authentication.
 * - A random visitor without the token can only see the status page — they
 *   cannot trigger pairing codes or read QR/pairing data.
 */

const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

/** Strip trailing slashes + trailing /pair so input like
 *  "https://app.onrender.com/" or ".../pair" both normalize correctly. */
function normalizePublicUrl(raw) {
    let url = String(raw || '').trim().replace(/\/+$/, '');
    url = url.replace(/\/pair$/i, '');
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
        // Validate it parses; also drop any credentials/path games.
        const parsed = new URL(url);
        if (parsed.username || parsed.password) return null;
        return `${parsed.protocol}//${parsed.host}`;
        // eslint-disable-next-line no-use-before-define
    } catch {
        return null;
    }
}

const publicUrl = normalizePublicUrl(process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '');

const webPairConfig = {
    enabled: process.env.EDBOTS_WEB_PAIRING_ENABLED !== 'false',

    // Base URL shown to the user (no path). null → UI derives it from window.location.
    publicUrl,

    // Top-level routes (NOT under /api so they work on platforms that only
    // forward root paths, e.g. Render's default web service).
    pagePath: '/pair',
    eventsPath: '/pair/events',
    statusPath: '/pair/status',
    pairRequestPath: '/pair/request-code',
    resetPath: '/pair/reset',

    // Bind address — cloud platforms assign the port, we must accept all interfaces.
    host: process.env.EDBOTS_PAIR_HOST || process.env.HOST || process.env.EDBOTS_API_HOST || '0.0.0.0',

    // Render/Railway/Heroku-style PORT (same one the API binds to).
    port: parseInt(process.env.PORT || '3000', 10),

    // Singleton pairing-token file lives under data/ (gitignored).
    tokenFile: path.join(ROOT_DIR, 'data', 'pairingToken.json'),

    // Token lifetime & housekeeping
    tokenTtlMs: parseInt(process.env.EDBOTS_PAIRING_TOKEN_TTL_MS || String(24 * 60 * 60 * 1000), 10),
    // How long a used/consumed token entry is kept before final deletion.
    graceMs: 60 * 60 * 1000,
    // How many pairs (token, IP) may attempt pairing codes per hour.
    maxPairingRequestsPerHour: parseInt(process.env.EDBOTS_PAIR_MAX_REQUESTS || '20', 10),

    // Session header/lifetime
    browserSessionCookieName: 'edbots_pair_session',
    browserSessionTtlMs: 12 * 60 * 60 * 1000,

    // SSE keepalive interval (ms) — Render kills idle connections at ~100s
    sseKeepAliveMs: 25000
};

module.exports = webPairConfig;
