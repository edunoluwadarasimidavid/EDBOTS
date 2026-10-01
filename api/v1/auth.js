/**
 * @file api/v1/auth.js
 * @description Authentication + authorization for /api/v1.
 *
 * Two accepted credential kinds:
 * 1. Authorization: Bearer <Appwrite JWT>  → hosted mode.
 *    Verified against Appwrite on every request (no local-only trust).
 *    Appwrite unreachable → 503-family failure (fail closed), never a
 *    silent pass-through.
 * 2. X-API-Key / Bearer apiKey            → self-hosted mode (existing
 *    SHA-256 hashed key store + env master key, unchanged).
 *
 * Authorization is separate from authentication: requireV1Scope checks
 * scopes; requirePremium additionally consults Appwrite membership
 * (user_id field in the users collection) and returns FORBIDDEN for
 * free-tier users. Premium results are cached per user for a short TTL
 * and never cached past the token's own expiry.
 */

const { authenticate } = require('../core/auth');
const { ApiError, unauthorized, forbidden } = require('../core/errors');
const appwrite = require('./appwriteClient');
const messageQuota = require('./messageQuota');

// ── Short-lived per-user premium cache ────────────────────────────────────
const PREMIUM_TTL_MS = 5 * 60 * 1000; // 5 minutes
const premiumCache = new Map(); // userId → { premium, expiresAt }

async function getCachedPremium(userId, tokenExpSec) {
  const hit = premiumCache.get(userId);
  const now = Date.now();
  if (hit && hit.expiresAt > now) return hit.premium;

  const { premium } = await appwrite.lookupMembership(userId);

  // Never cache past the token's own expiry (hardening rule 3.5): a fresh
  // login after expiry must not inherit a stale premium answer.
  let ttl = PREMIUM_TTL_MS;
  if (tokenExpSec) {
    const untilExpiry = tokenExpSec * 1000 - now;
    if (untilExpiry <= 0) throw unauthorized('Token expired');
    ttl = Math.min(ttl, untilExpiry);
  }
  premiumCache.set(userId, { premium, expiresAt: now + ttl });
  return premium;
}

/**
 * v1 authentication middleware context factory.
 * @returns {Promise<{
 *   kind:'jwt'|'apiKey', userId:string, keyId?:string, owner?:string,
 *   scopes:string[], expSec:number|null, premium?:boolean, isAppwrite:boolean
 * }>}
 */
/**
 * Part C: register the authenticated operator identity for the runtime
 * message-quota layer. The WhatsApp handler has no HTTP context, so the
 * LAST authenticated v1 request defines the active operator (the product is
 * single-session/single-owner; v1 also gates start/stop).
 */
function registerOperator(auth) {
  if (!auth || !auth.userId) return;
  messageQuota.setActiveOperator({
    userId: auth.userId,
    isPremium: auth.premium === true,
    isAppwrite: auth.isAppwrite === true
  });
}

async function authenticateV1(req) {
  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const apiKeyHeader = req.headers['x-api-key'];

  // ── 1. Appwrite JWT (Bearer that is not a stored API key) ─────────────
  // Try the JWT path when a Bearer token is present AND it is not matched
  // by the self-hosted API-key store (which is checked first and is
  // authoritative for self-hosted deployments).
  if (bearer) {
    try {
      const legacy = authenticate(req); // throws 401 if not an API key
      return {
        kind: 'apiKey',
        userId: legacy.owner,
        keyId: legacy.keyId,
        owner: legacy.owner,
        scopes: legacy.scopes,
        expSec: null,
        isAppwrite: false
      };
    } catch (legacyErr) {
      // Not a valid self-hosted API key → treat the Bearer value as an
      // Appwrite JWT (hosted mode). If THAT fails too → 401 below.
      if (!bearer.includes('.')) {
        // JWTs always have two dots; a dotless bearer that failed key match
        // is just a bad key.
        throw legacyErr;
      }
      let account;
      try {
        account = await appwrite.verifyJwt(bearer);
      } catch (appwriteErr) {
        // Appwrite unreachable / 5xx / timeout → fail CLOSED with a 503.
        console.error('[API v1] Appwrite verification failed:', appwriteErr.message);
        throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Auth service temporarily unavailable');
      }
      if (!account) {
        throw unauthorized('Invalid or expired token.');
      }
      return {
        kind: 'jwt',
        userId: account.userId,
        name: account.name,
        email: account.email,
        scopes: ['read', 'write'], // JWT users get full member scopes; premium checked separately
        expSec: account.exp,
        isAppwrite: true
      };
    }
  }

  // ── 2. X-API-Key only (self-hosted mode) ──────────────────────────────
  if (apiKeyHeader) {
    const legacy = authenticate(req); // throws 401 on bad key
    return {
      kind: 'apiKey',
      userId: legacy.owner,
      keyId: legacy.keyId,
      owner: legacy.owner,
      scopes: legacy.scopes,
      expSec: null,
      isAppwrite: false
    };
  }

  throw unauthorized('Missing credentials. Send Authorization: Bearer <token> or X-API-Key.');
}

/**
 * Middleware factory: authenticate (JWT or API key) and require a scope.
 * Attaches req.v1Auth.
 */
function requireV1Scope(requiredScope) {
  return async (req) => {
    const auth = await authenticateV1(req);
    if (!auth.scopes.includes(requiredScope) && !auth.scopes.includes('admin')) {
      throw forbidden(`This action requires the '${requiredScope}' scope.`);
    }
    req.v1Auth = auth;
    registerOperator(auth); // Part C: keep the runtime quota operator in sync
  };
}

/**
 * Premium decision for an authenticated v1 identity. Shared by the
 * requirePremium() middleware and the ad gate's requireAdOrPremium().
 * Self-hosted API keys are the local authority and always pass; Appwrite
 * users go through the (cached) membership lookup.
 * @returns {Promise<boolean>} true when the user may skip gates/ads.
 */
async function checkPremium(auth) {
  if (!auth) throw unauthorized('Not authenticated');
  if (!auth.isAppwrite) return true; // self-hosted key: local authority
  const premium = await getCachedPremium(auth.userId, auth.expSec);
  if (premium) auth.premium = true;
  return premium;
}

/**
 * Middleware factory for premium-gated v1 routes. Must run AFTER
 * requireV1Scope (needs req.v1Auth). Free-tier Appwrite users → 403
 * FORBIDDEN; self-hosted admin/master keys pass (they own the bot).
 */
function requirePremium() {
  return async (req) => {
    const premium = await checkPremium(req.v1Auth);
    if (!premium) {
      throw forbidden('This feature requires an EDBOTS premium subscription.');
    }
  };
}

module.exports = { authenticateV1, requireV1Scope, requirePremium, checkPremium, _premiumCache: premiumCache };
