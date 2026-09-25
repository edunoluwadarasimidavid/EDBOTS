/**
 * @file api/webpair/publicUrl.js
 * @description Platform-agnostic public URL detection for the web pairing UI.
 *
 * Priority order (first hit wins):
 *   1. config.js webPairing.publicUrl (owner-set, the supported place to
 *      configure this — .env stays reserved for REST API/Appwrite secrets)
 *   2. Platform-injected environment variables (Render, Railway, Fly.io,
 *      Heroku, Codespaces, Gitpod, Vercel, Koyeb, Northflank, etc.)
 *   3. LAN addresses of this machine (os.networkInterfaces) — so on a home
 *      server / VPS the owner gets tappable http://IP:PORT/pair URLs
 *   4. First browser request: the Host header learned by the web pairing
 *      server (works behind ANY reverse proxy / tunnel, no config needed)
 *
 * Never throws; always returns something usable.
 */

const os = require('os');

/** Platform-injected URL/host env vars (checked in order). */
const PLATFORM_ENV_VARS = [
    'EDBOTS_PUBLIC_URL',        // explicit override without touching .env
    'RENDER_EXTERNAL_URL',      // Render
    'RAILWAY_PUBLIC_DOMAIN',    // Railway
    'FLY_APP_HOSTNAME',         // Fly.io (fly-global-services is IPv6-only)
    'HEROKU_APP_NAME',          // Heroku (dyno metadata must be enabled)
    'KOYEB_PUBLIC_DOMAIN',      // Koyeb
    'CODESPACE_NAME',           // GitHub Codespaces (needs -3000 preview host)
    'GITPOD_WORKSPACE_URL',     // Gitpod
    'VERCEL_URL',               // Vercel
    'CF_PAGES_URL',             // Cloudflare Pages (static, but harmless)
    'PUBLIC_URL'                // legacy name, still honored for back-compat
];

/** Normalize "example.com" / "example.com/" / "https://x/pair" -> origin. */
function normalizeOrigin(raw) {
    let value = String(raw || '').trim().replace(/\/+$/, '');
    value = value.replace(/\/pair$/i, '');
    if (!value) return null;
    if (!/^https?:\/\//i.test(value)) {
        // Codespaces/Gitpod URLs arrive without a scheme sometimes
        value = `https://${value}`;
    }
    try {
        const parsed = new URL(value);
        if (parsed.username || parsed.password) return null;
        return `${parsed.protocol}//${parsed.host}`;
    } catch {
        return null;
    }
}

/** Gitpod workspaces need the port folded into the hostname. */
function gitpodUrl(workspaceUrl, port) {
    try {
        const u = new URL(workspaceUrl.startsWith('http') ? workspaceUrl : `https://${workspaceUrl}`);
        const host = u.hostname.replace(/^https?:\/\//, '');
        return `https://${port}-${host}`;
    } catch {
        return null;
    }
}

/** Collect non-internal IPv4 addresses of this machine (LAN/VPS). */
function lanAddresses() {
    const out = [];
    try {
        const nets = os.networkInterfaces();
        for (const addrs of Object.values(nets)) {
            for (const net of addrs || []) {
                if (net.family === 'IPv4' && !net.internal) {
                    out.push(net.address);
                }
            }
        }
    } catch {
        /* keep empty */
    }
    return out;
}

/**
 * Detect a public URL from config + platform env vars.
 * @param {string} [configUrl] value from config.js webPairing.publicUrl
 * @param {number} [port] port for LAN fallback URLs
 * @returns {{ url: string|null, source: 'config'|'platform'|null, platformVar: string|null, lanIps: string[] }}
 */
function detectPublicUrl(configUrl, port = parseInt(process.env.PORT || '3000', 10)) {
    // 1. config.js (owner-managed)
    const fromConfig = normalizeOrigin(configUrl);
    if (fromConfig) return { url: fromConfig, source: 'config', platformVar: null, lanIps: lanAddresses() };

    // 2. Platform env vars
    for (const envVar of PLATFORM_ENV_VARS) {
        const raw = process.env[envVar];
        if (!raw) continue;

        if (envVar === 'CODESPACE_NAME') {
            const url = `https://${raw}-${port}.githubpreview.dev`;
            return { url, source: 'platform', platformVar: envVar, lanIps: lanAddresses() };
        }
        if (envVar === 'GITPOD_WORKSPACE_URL') {
            const url = gitpodUrl(raw, port);
            if (url) return { url, source: 'platform', platformVar: envVar, lanIps: lanAddresses() };
            continue;
        }
        const normalized = normalizeOrigin(raw);
        if (normalized) {
            return { url: normalized, source: 'platform', platformVar: envVar, lanIps: lanAddresses() };
        }
    }

    // 3. Nothing yet — the web pairing server learns the real URL from the
    //    first browser request (Host header), and we offer LAN candidates.
    return { url: null, source: null, platformVar: null, lanIps: lanAddresses() };
}

module.exports = { detectPublicUrl, normalizeOrigin, lanAddresses, PLATFORM_ENV_VARS };
