/**
 * @file api/v1/appwriteClient.js
 * @description Minimal zero-dependency Appwrite client for the /api/v1 auth
 * layer (the bot's only runtime dependency surface is Baileys; the API layer
 * deliberately stays dependency-free, so this uses node:https directly).
 *
 * Two operations only:
 * 1. verifyJwt(jwt) → GET {endpoint}/account  with Bearer <jwt>
 *    - 200 → { userId, name, email, exp }
 *    - 401 → null (invalid/expired token)
 *    - network/5xx/timeout → throws (caller MUST return 503, fail closed)
 *
 *    NOTE: Appwrite JWTs are opaque tokens verified server-side by
 *    Appwrite itself; we never trust local decoding for the accept decision.
 *    The JWT body's exp (Appwrite JWTs embed an "exp" claim) is only used as
 *    a belt-and-braces secondary check and for cache expiry bounds.
 *
 * 2. lookupMembership(userId) → GET
 *    {endpoint}/databases/{db}/collections/{users}/documents
 *      with X-Appwrite-Project + queries: equal(user_id, userId), limit(1)
 *    - 200 → { premium: boolean }  (a document row means premium)
 *    - 404 (unknown collection/db) → throws (misconfiguration, fail closed)
 *    - network/5xx/timeout → throws (fail closed → 503)
 */

const https = require('https');
const { URL } = require('url');
const config = require('./appwrite.config');

/**
 * Perform a JSON request against the Appwrite API.
 * @returns {Promise<{status:number, body:object}>}
 */
function appwriteRequest(path, { headers = {}, timeoutMs = config.timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, config.endpoint);

    const req = https.request(
      url,
      {
        method: 'GET',
        headers: {
          'X-Appwrite-Project': config.projectId,
          'Content-Type': 'application/json',
          ...headers
        },
        timeout: timeoutMs
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let body = {};
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            body = { raw };
          }
          resolve({ status: res.statusCode, body });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('Appwrite request timed out'));
    });
    req.on('error', reject);
    req.end();
  });
}

/** Decode (NOT verify) a JWT payload for the exp field only. */
function decodeExp(jwt) {
  try {
    const parts = String(jwt).split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Verify an Appwrite JWT against Appwrite itself.
 * @param {string} jwt
 * @returns {Promise<{userId:string,name:string,email:string,exp:number|null}|null>}
 *   null = token rejected by Appwrite (invalid/expired) → caller returns 401.
 * @throws on network/timeout/5xx/4xx-other → caller returns 503 (fail closed).
 */
async function verifyJwt(jwt) {
  // Never even call Appwrite with an expired token: a rejected-then-cached
  // "valid" result must not outlive the token's own expiry (hardening 3.5).
  const exp = decodeExp(jwt);
  if (exp !== null && exp * 1000 <= Date.now()) {
    return null;
  }

  let res;
  try {
    res = await appwriteRequest('/account', {
      headers: { Authorization: `Bearer ${jwt}` }
    });
  } catch (err) {
    throw new Error(`Appwrite unreachable: ${err && err.message ? err.message : err}`);
  }

  if (res.status === 401) return null; // Appwrite rejected the token

  if (res.status !== 200) {
    throw new Error(`Appwrite account lookup failed with HTTP ${res.status}`);
  }

  const account = res.body || {};
  const userId = account.$id || account.userId;
  if (!userId) throw new Error('Appwrite account response missing user id');

  // If Appwrite says valid but the embedded exp is already past (clock skew
  // guard), treat as expired.
  if (exp !== null && exp * 1000 <= Date.now()) return null;

  return {
    userId,
    name: account.name || null,
    email: account.email || null,
    exp
  };
}

/**
 * Look up the membership record for a user in the users collection.
 * @param {string} userId
 * @returns {Promise<{premium:boolean}>}
 * @throws on network/timeout/non-200 → caller returns 503 (fail closed).
 */
async function lookupMembership(userId) {
  const path =
    `/databases/${config.databaseId}/collections/${config.usersCollectionId}/documents` +
    `?queries[]=${encodeURIComponent(
      JSON.stringify({ method: 'equal', attribute: config.membershipUserIdField, values: [userId] })
    )}&limit=1`;

  let res;
  try {
    res = await appwriteRequest(path);
  } catch (err) {
    throw new Error(`Appwrite unreachable: ${err && err.message ? err.message : err}`);
  }

  if (res.status !== 200) {
    throw new Error(`Appwrite membership lookup failed with HTTP ${res.status}`);
  }

  const docs = Array.isArray(res.body && res.body.documents) ? res.body.documents : [];
  return { premium: config.isPremiumFn(docs) };
}

module.exports = { verifyJwt, lookupMembership, decodeExp };
