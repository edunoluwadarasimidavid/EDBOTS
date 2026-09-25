/**
 * @file api/webpair/config.js
 * @description Configuration for the web pairing interface (sensitive!).
 *
 * URL resolution priority:
 *   1. config.js -> webPairing.publicUrl  (owner-edited file — the supported
 *      place for deployment settings; .env stays for REST API/Appwrite)
 *   2. Platform-injected env vars (Render/Railway/Fly/Heroku/Codespaces/…)
 *      detected automatically — no configuration needed on those hosts
 *   3. Learned live from the first browser request (Host header), which also
 *      covers tunnels (ngrok/cloudflared) and any reverse proxy
 *   4. LAN IP candidates shown in the console
 *
 * Token security model (see tokenStore.js):
 * - A cryptographically random token is generated on every boot when auth
 *   is pending. It is printed to the SERVER's log/terminal only.
 * - Tokens expire and are invalidated after successful authentication.
 * - A random visitor without the token can only see the token form — they
 *   cannot trigger pairing codes or read QR/pairing data.
 */

const path = require('path');
const os = require('os');
const { detectPublicUrl } = require('./publicUrl');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

// Owner settings from the central config file (all optional).
let cfgSettings = {};
try {
    // eslint-disable-next-line global-require
    const legacy = require('../../config');
    cfgSettings = legacy.webPairing || {};
} catch {
    cfgSettings = {};
}

const port = parseInt(process.env.PORT || '3000', 10);

const detected = detectPublicUrl(cfgSettings.publicUrl, port);

const webPairConfig = {
    enabled: cfgSettings.enabled !== false && process.env.EDBOTS_WEB_PAIRING_ENABLED !== 'false',

    // Resolved public base URL (no path) or null until a browser is seen.
    publicUrl: detected.url,
    publicUrlSource: detected.source, // 'config' | 'platform' | null
    platformVar: detected.platformVar,
    lanIps: detected.lanIps,

    // Top-level routes (NOT under /api so they work on platforms that only
    // forward root paths, e.g. Render's default web service).
    pagePath: '/pair',
    eventsPath: '/pair/events',
    statusPath: '/pair/status',
    pairRequestPath: '/pair/request-code',
    resetPath: '/pair/reset',

    // Bind address — cloud platforms assign the port, we must accept all interfaces.
    host: process.env.EDBOTS_PAIR_HOST || process.env.HOST || '0.0.0.0',
    port,

    // Singleton pairing-token file lives under data/ (gitignored).
    tokenFile: path.join(ROOT_DIR, 'data', 'pairingToken.json'),

    // Token lifetime & housekeeping
    tokenTtlMs: parseInt(process.env.EDBOTS_PAIRING_TOKEN_TTL_MS || String(24 * 60 * 60 * 1000), 10),
    // How many pairing-code requests (token, IP) may be made per hour.
    maxPairingRequestsPerHour: parseInt(process.env.EDBOTS_PAIR_MAX_REQUESTS || '20', 10),

    // Browser session cookie lifetime
    browserSessionCookieName: 'edbots_pair_session',
    browserSessionTtlMs: 12 * 60 * 60 * 1000,

    // SSE keepalive interval (ms) — platforms kill idle connections (~100s)
    sseKeepAliveMs: 25000,

    // ── Live learning ──────────────────────────────────────────────────
    /** Origin learned from the first real browser request (Host header). */
    _learnedOrigin: null,

    /** Record the origin a real browser used (once; first wins). */
    learnOrigin(hostHeader, isLocalAddress) {
        if (!hostHeader || this._learnedOrigin) return false;
        // Never learn from health-check / local probe hosts when a public
        // candidate already exists.
        this._learnedOrigin = /^https?:\/\//.test(hostHeader) ? hostHeader : `http://${hostHeader}`;
        this._learnedIsLocal = !!isLocalAddress;
        return true;
    },

    /** Best-known base URL right now (learned beats detected only if non-local). */
    getBaseUrl() {
        if (this._learnedOrigin) {
            try {
                const u = new URL(this._learnedOrigin);
                // A public learned origin always wins (it's what the user typed).
                if (!this._learnedIsLocal) return `${u.protocol}//${u.host}`;
                // Learned-but-local still helps over no URL at all.
                return this.publicUrl || `${u.protocol}//${u.host}`;
            } catch {
                /* fall through */
            }
        }
        return this.publicUrl || null;
    },

    /** Current server's LAN IPv4 (for console hints). */
    primaryLanIp() {
        return this.lanIps[0] || null;
    }
};

module.exports = webPairConfig;
