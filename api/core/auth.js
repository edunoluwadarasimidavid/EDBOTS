/**
 * @file api/core/auth.js
 * @description API-key authentication and per-user authorization.
 *
 * Model (kept intentionally simple and secure):
 * - Every request must send a key via `X-API-Key` header or `Authorization: Bearer <key>`.
 * - The master key comes from the EDBOTS_API_KEY env var (server-side only).
 * - Additional per-user keys live in data/apiKeys.json (gitignored) and are
 *   stored ONLY as SHA-256 hashes — a leaked keys file exposes nothing.
 * - Every key has an `owner` identity; routes use it to enforce "users can
 *   only control their own bot" scoping.
 * - Missing key → 401. Bad key → 401. Revoked key → 401. Wrong scope → 403.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { unauthorized } = require('./errors');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

let keysCache = { mtimeMs: 0, keys: [] };

function loadKeys() {
  try {
    if (!fs.existsSync(config.keysFile)) {
      keysCache = { mtimeMs: 0, keys: [] };
      return keysCache.keys;
    }
    const stat = fs.statSync(config.keysFile);
    if (stat.mtimeMs !== keysCache.mtimeMs) {
      const parsed = JSON.parse(fs.readFileSync(config.keysFile, 'utf8'));
      keysCache = {
        mtimeMs: stat.mtimeMs,
        keys: Array.isArray(parsed.keys) ? parsed.keys : []
      };
    }
  } catch (err) {
    console.error('[API Auth] Failed to load API keys file:', err.message);
    keysCache = { mtimeMs: 0, keys: [] };
  }
  return keysCache.keys;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function extractKey(req) {
  const headerKey = req.headers['x-api-key'];
  if (headerKey && typeof headerKey === 'string') return headerKey.trim();

  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();

  return null;
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Authenticate the request.
 * @returns {{ keyId: string, owner: string, scopes: string[] }} auth context
 */
function authenticate(req) {
  const provided = extractKey(req);

  if (!provided) {
    throw unauthorized('Missing API key. Send it as X-API-Key header or Authorization: Bearer <key>.');
  }

  const keys = loadKeys();

  // 1. Per-user keys (stored as SHA-256 hashes)
  for (const entry of keys) {
    if (!entry || entry.revoked) continue;
    if (timingSafeEqual(sha256(provided), entry.keyHash)) {
      return {
        keyId: entry.keyId,
        owner: entry.owner,
        scopes: Array.isArray(entry.scopes) ? entry.scopes : ['read', 'write']
      };
    }
  }

  // 2. Master key from env
  if (config.masterKey && timingSafeEqual(provided, config.masterKey)) {
    return { keyId: 'master', owner: 'system', scopes: ['read', 'write', 'admin'] };
  }

  throw unauthorized('Invalid or revoked API key.');
}

module.exports = { authenticate, sha256, extractKey };
