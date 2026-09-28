/**
 * @file publicEndpoint.js
 * @description Determines WHERE this EDBOTS instance is actually reachable
 * from the internet, without ever fabricating a URL.
 *
 * Core rules (the whole point of this module):
 *   - Local bind info (0.0.0.0 / PORT / 127.0.0.1) is LOCAL ONLY. It is never
 *     presented as a public address.
 *   - Platform-injected public URLs (Render/Railway/Fly/Heroku/…) are used
 *     as-is, WITHOUT appending the internal port (reverse proxies serve
 *     these on 443 — "https://app.com", never "https://app.com:3000").
 *   - A public IP is only an UNVERIFIED CANDIDATE: egress IP ≠ open port.
 *     It is labelled LOW confidence and never claimed to work.
 *   - Reachability is only ever reported after a real HTTP request to the
 *     candidate's health endpoint (the user's own server, no port scanning).
 *   - An owner-provided KEEPALIVE_URL always wins over automatic detection.
 *
 * Reuses the platform detection the web-pairing UI already ships with
 * (api/webpair/publicUrl.js) — one source of truth, no duplicate logic.
 */

const { detectPublicUrl, isPrivateIp, fetchPublicIp } = require('../api/webpair/publicUrl');

/** Path of the public liveness endpoint served by the REST API. */
const HEALTH_PATH = '/api/health';

/** Explicit owner override env vars, in priority order. */
const EXPLICIT_URL_VARS = ['KEEPALIVE_URL', 'KEEP_ALIVE_URL'];

/**
 * Local (bind) information for the in-process REST API server.
 * Mirrors api/core/config.js resolution exactly.
 */
function localInfo() {
    const localHost = process.env.EDBOTS_API_HOST || process.env.HOST || '0.0.0.0';
    const localPort = parseInt(process.env.EDBOTS_API_PORT || process.env.PORT || '3000', 10);
    return {
        localHost,
        localPort,
        localUrl: `http://127.0.0.1:${localPort}`,
        healthUrl: `http://127.0.0.1:${localPort}${HEALTH_PATH}`
    };
}

/**
 * Detect the best-known public endpoint of THIS server.
 *
 * @param {object} [options]
 * @param {boolean} [options.includePublicIp=true] also try the public-IP echo
 * @returns {Promise<{
 *   localHost: string, localPort: number, localUrl: string,
 *   publicIp: string|null, publicHost: string|null, publicUrl: string|null,
 *   source: 'explicit'|'environment'|'platform'|'public-ip'|'unknown',
 *   sourceVar: string|null,
 *   confidence: 'high'|'medium'|'low'|'unknown',
 *   externallyReachable: boolean|'unknown',
 *   verifiedUrl: string|null,
 *   unverifiedCandidate: boolean
 * }>}
 */
async function detectPublicEndpoint(options = {}) {
    const includePublicIp = options.includePublicIp !== false;
    const local = localInfo();

    const result = {
        ...local,
        publicIp: null,
        publicHost: null,
        publicUrl: null,
        source: 'unknown',
        sourceVar: null,
        confidence: 'unknown',
        externallyReachable: 'unknown',
        verifiedUrl: null,
        unverifiedCandidate: false,
        explicitLocal: false
    };

    // ── 1. Owner-provided URL (KEEPALIVE_URL / KEEP_ALIVE_URL) ──────
    // Parsed leniently (docker service names / internal hosts allowed — the
    // owner explicitly asked for it) but always labelled honestly via
    // explicitLocal so the panel never calls an internal URL "public".
    for (const envVar of EXPLICIT_URL_VARS) {
        const raw = (process.env[envVar] || '').trim();
        if (!raw) continue;
        const origin = normalizeExplicit(raw);
        if (!origin) continue; // invalid value — ignore, never guess
        const r = finish(origin, 'explicit', envVar, 'high');
        r.explicitLocal = isLocalHost(origin);
        return r;
    }
    // config.js webPairing.publicUrl is owner-managed too
    try {
        const cfgUrl = (require('../config').webPairing || {}).publicUrl;
        const origin = normalizeOrigin(cfgUrl);
        if (origin) return finish(origin, 'environment', 'config.js webPairing.publicUrl', 'high');
    } catch { /* config.js unreadable — ignore */ }

    // ── 2. Hosting platform env vars (full URLs/domains, no port appended) ──
    try {
        const detected = detectPublicUrl(null, local.localPort);
        if (detected.url) {
            return finish(
                detected.url,
                detected.source === 'config' ? 'environment' : 'platform',
                detected.platformVar,
                'high'
            );
        }
    } catch { /* detection is best-effort */ }

    // ── 3. Public egress IP → UNVERIFIED candidate only ────────────────
    if (includePublicIp) {
        const ip = await fetchPublicIp().catch(() => null);
        if (ip && !isPrivateIp(ip)) {
            const candidate = `http://${ip}:${local.localPort}`;
            const r = finish(candidate, 'public-ip', 'public IP echo', 'low');
            r.publicIp = ip;
            r.publicHost = ip;
            r.unverifiedCandidate = true;
            return r;
        }
    }

    // ── 4. Nothing known. Honest result: no public endpoint. ───────────
    return result;

    // Helper: attach hostname info and return the final object
    function finish(origin, source, sourceVar, confidence) {
        result.publicUrl = origin;
        try {
            result.publicHost = new URL(origin).hostname;
        } catch { /* keep null */ }
        result.source = source;
        result.sourceVar = sourceVar;
        result.confidence = confidence;
        return result;
    }
}

/**
 * Normalize a user/platform URL into an origin (scheme + host[, port]).
 * STRICT variant for automatic detection: rejects garbage, single-label
 * hostnames and local addresses — they must never masquerade as public.
 */
function normalizeOrigin(raw) {
    let value = String(raw || '').trim().replace(/\/+$/, '');
    value = value.replace(/\/pair$/i, '').replace(/\/api\/health$/i, '');
    if (!value) return null;
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    try {
        const parsed = new URL(value);
        if (parsed.username || parsed.password) return null;
        if (!parsed.hostname || !parsed.hostname.includes('.')) return null; // reject "my-bot" style hostnames
        if (isLocalHost(`${parsed.protocol}//${parsed.host}`)) return null; // local addresses are NOT public
        return `${parsed.protocol}//${parsed.host}`;
    } catch {
        return null;
    }
}

/**
 * LENIENT variant for OWNER-PROVIDED overrides only (KEEPALIVE_URL):
 * the owner may deliberately point at an internal address (docker service
 * name, localhost during development). Still rejects unparseable garbage.
 * Callers must check isLocalHost() on the result and label accordingly.
 */
function normalizeExplicit(raw) {
    let value = String(raw || '').trim().replace(/\/+$/, '');
    value = value.replace(/\/pair$/i, '').replace(/\/api\/health$/i, '');
    if (!value) return null;
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    try {
        const parsed = new URL(value);
        if (parsed.username || parsed.password) return null;
        if (!parsed.hostname) return null;
        return `${parsed.protocol}//${parsed.host}`;
    } catch {
        return null;
    }
}

/** True when an origin points at loopback / this machine only. */
function isLocalHost(origin) {
    try {
        const h = new URL(origin).hostname.toLowerCase();
        return h === 'localhost' || h === '0.0.0.0' || h === '::1' || /^127\./.test(h) || h.endsWith('.local');
    } catch {
        return false;
    }
}

/**
 * Make ONE real HTTP(S) request to a candidate health endpoint to see if it
 * actually answers. Only used on the user's OWN server endpoint — this is
 * verification, never scanning.
 *
 * @param {string} url full health URL
 * @param {number} [timeoutMs=8000]
 * @returns {Promise<{reachable: boolean, status: number|null, latencyMs: number|null, reason: string|null}>}
 */
function verifyEndpoint(url, timeoutMs = 8000) {
    const started = Date.now();
    return new Promise((resolve) => {
        let settled = false;
        const done = (r) => {
            if (settled) return;
            settled = true;
            resolve(r);
        };

        try {
            const client = url.startsWith('https') ? require('https') : require('http');
            const req = client.get(url, { timeout: timeoutMs, headers: { 'User-Agent': 'EDBOTS-KeepAlive/2' } }, (res) => {
                res.resume(); // drain
                const latencyMs = Date.now() - started;
                // 2xx/3xx → the endpoint genuinely answered with success
                if (res.statusCode >= 200 && res.statusCode < 400) {
                    done({ reachable: true, status: res.statusCode, latencyMs, reason: null });
                } else {
                    // Host answered but the endpoint is wrong/broken — the
                    // SERVER is reachable, the URL itself is not healthy.
                    done({ reachable: false, status: res.statusCode, latencyMs, reason: `HTTP ${res.statusCode}` });
                }
            });
            req.on('timeout', () => {
                req.destroy(new Error('timeout'));
                done({ reachable: false, status: null, latencyMs: Date.now() - started, reason: `timeout after ${timeoutMs}ms` });
            });
            req.on('error', (err) => {
                done({ reachable: false, status: null, latencyMs: Date.now() - started, reason: describeNetworkError(err) });
            });
        } catch (err) {
            done({ reachable: false, status: null, latencyMs: null, reason: describeNetworkError(err) });
        }
    });
}

/** Human-friendly network error descriptions (DNS, refused, TLS, …). */
function describeNetworkError(err) {
    const code = err && err.code;
    switch (code) {
        case 'ENOTFOUND':
        case 'EAI_AGAIN':
            return 'DNS lookup failed (hostname not resolvable)';
        case 'ECONNREFUSED':
            return 'connection refused (port closed or service down)';
        case 'ECONNRESET':
            return 'connection reset by peer';
        case 'ETIMEDOUT':
            return 'connection timed out';
        case 'EHOSTUNREACH':
        case 'ENETUNREACH':
            return 'host/network unreachable';
        case 'CERT_HAS_EXPIRED':
        case 'DEPTH_ZERO_SELF_SIGNED_CERT':
        case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
        case 'ERR_TLS_CERT_ALTNAME_INVALID':
            return `TLS certificate problem (${code})`;
        default:
            return (err && err.message) || 'unknown network error';
    }
}

module.exports = {
    HEALTH_PATH,
    localInfo,
    detectPublicEndpoint,
    normalizeOrigin,
    normalizeExplicit,
    isLocalHost,
    verifyEndpoint,
    describeNetworkError
};
