/**
 * @file api/webpair/tokenStore.js
 * @description Singleton pairing-token store for the web pairing interface.
 *
 * Security model:
 * - One active pairing token at a time. It is created when the bot starts
 *   without a WhatsApp session, printed to the SERVER console (which the
 *   owner controls), and required for any endpoint that can trigger pairing
 *   or reveal QR/pairing data.
 * - Cryptographically random (32 bytes), hashed at rest, time-limited,
 *   invalidated after successful authentication, and rotatable on logout.
 * - The plaintext token never leaves the server console; only its SHA-256
 *   hash is persisted to data/pairingToken.json (gitignored).
 * - In-memory per-token, per-IP rate limiting caps how often pairing codes
 *   may be requested, blocking brute-force/abuse from the token holder too.
 */

const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');

/** @type {{ tokenHash: string|null, createdAt: number|null, expiresAt: number|null, consumedAt: number|null }} */
let current = null;

// Load any persisted token on boot (survives short restarts).
try {
    if (fs.existsSync(config.tokenFile)) {
        const parsed = JSON.parse(fs.readFileSync(config.tokenFile, 'utf8'));
        if (parsed && typeof parsed.tokenHash === 'string') {
            current = {
                tokenHash: parsed.tokenHash,
                createdAt: Number(parsed.createdAt) || Date.now(),
                expiresAt: Number(parsed.expiresAt) || Date.now() + config.tokenTtlMs,
                consumedAt: Number(parsed.consumedAt) || null
            };
        }
    }
} catch {
    current = null;
}

const sha256 = (value) =>
    crypto.createHash('sha256').update(String(value)).digest('hex');

function persist() {
    try {
        if (!current) {
            fs.removeSync(config.tokenFile);
            return;
        }
        fs.ensureDirSync(path.dirname(config.tokenFile));
        fs.writeJsonSync(config.tokenFile, current, { spaces: 2 });
    } catch (err) {
        // Non-fatal: an in-memory token still works; it just won't survive restart.
        console.error('[Pairing] Failed to persist token file:', err && err.message);
    }
}

/** Generate a new active token. Returns the PLAINTEXT (shown once, in console). */
function create() {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    current = {
        tokenHash: sha256(token),
        createdAt: now,
        expiresAt: now + config.tokenTtlMs,
        consumedAt: null
    };
    persist();
    return token;
}

/** Ensure a valid (unexpired, unconsumed) token exists; create one if not. */
function ensure() {
    if (!isValidTokenHash()) {
        return create();
    }
    return null; // no new token; caller reads the existing one from file
}

function isValidTokenHash() {
    if (!current || !current.tokenHash) return false;
    if (current.consumedAt) return false;
    if (Date.now() >= current.expiresAt) return false;
    return true;
}

/** Timing-safe hash comparison against the active token. */
function verify(token) {
    if (!isValidTokenHash() || !token) return false;
    const provided = Buffer.from(sha256(token));
    const stored = Buffer.from(current.tokenHash);
    if (provided.length !== stored.length) return false;
    return crypto.timingSafeEqual(provided, stored);
}

/** Invalidate after successful authentication (or owner request). */
function consume() {
    if (current) {
        current.consumedAt = Date.now();
        persist();
    }
}

/** Drop any token state entirely (logout → fresh pairing next boot). */
function reset() {
    current = null;
    persist();
}

// ── Per-token, per-IP attempt limiting ────────────────────────────────────
/** Map<`${tokenHash}:${ip}`, number[]> — attempt timestamps. */
const attempts = new Map();

function tooManyAttempts(token, ip) {
    if (!current) return true;
    const key = `${current.tokenHash.slice(0, 16)}:${ip || 'unknown'}`;
    const now = Date.now();
    const windowStart = now - 60 * 60 * 1000;
    const list = (attempts.get(key) || []).filter((t) => t > windowStart);
    list.push(now);
    attempts.set(key, list);
    // Opportunistic cleanup
    if (attempts.size > 500) {
        for (const [k, v] of attempts) {
            if (!v.some((t) => t > windowStart)) attempts.delete(k);
        }
    }
    return list.length > config.maxPairingRequestsPerHour;
}

module.exports = {
    create,
    ensure,
    verify,
    consume,
    reset,
    tooManyAttempts,
    isValid: isValidTokenHash
};
