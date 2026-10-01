/**
 * @file api/v1/adGate.js
 * @description Unity LevelPlay server-to-server (S2S) ad verification,
 * simplified token-URL model (NO signature verification — per product
 * decision the callback URL itself is the secret; no LevelPlay private key
 * is referenced anywhere in this codebase).
 *
 * Flow:
 * 1. Client: POST /api/v1/ads/session {action} → {pendingKey} (5-min TTL).
 * 2. User watches the rewarded ad in the Android app.
 * 3. LevelPlay calls GET /api/v1/ads/callback/<LEVELPLAY_CALLBACK_TOKEN>
 *    ?userId=..&eventId=..&rewards=..  (PUBLIC endpoint; the URL path secret
 *    is the only barrier — configured in the LevelPlay dashboard).
 * 4. Client polls GET /api/v1/ads/status?action=... → { verified }.
 * 5. The gated action consumes the verified entry via consumeVerifiedEntry()
 *    (deleted the moment it is spent).
 *
 * Security notes:
 * - LEVELPLAY_CALLBACK_TOKEN is never logged, never returned in any response
 *   body, and never appears in docs. A wrong token gets a generic 404.
 * - Token comparison is constant-time (sha256-digest compare, so token
 *   length is not leaked either).
 * - eventId is deduplicated: LevelPlay retries never re-grant a reward.
 * - A valid callback ALWAYS acks 200 "[eventId]:OK" once handled — even when
 *   no pending session matches — so LevelPlay stops retrying. Only genuine
 *   transient errors (wanting a retry) propagate as non-200.
 */

const crypto = require('crypto');
const { ApiError } = require('../core/errors');
const { sendError } = require('./respond');
const { checkPremium } = require('./auth');
const messageQuota = require('./messageQuota');
const { checkRateLimit } = require('../core/http');
const apiConfig = require('../core/config');

// ── Tunables ───────────────────────────────────────────────────────────────
const PENDING_TTL_MS = parseInt(process.env.EDBOTS_AD_SESSION_TTL_MS || String(5 * 60 * 1000), 10);
const MAX_PENDING_ENTRIES = 10000;
const MAX_PROCESSED_EVENTS = 10000;

/** Actions a rewarded-ad session can unlock. */
const AD_ACTIONS = ['start_bot', 'stop_bot', 'raise_limit'];

// ── Stores (in-memory; single bot process) ─────────────────────────────────
// key `${userId}|${action}` → { userId, action, issuedAt, expiresAt, verified }
const pending = new Map();
// eventId → issuedAt (dedup registry)
const processedEvents = new Map();

// ── Helpers ────────────────────────────────────────────────────────────────

function callbackToken() {
  return process.env.LEVELPLAY_CALLBACK_TOKEN || '';
}

/**
 * Constant-time equality that does not leak length: compare SHA-256 digests
 * instead of raw buffers.
 */
function constantTimeEqual(a, b) {
  const da = crypto.createHash('sha256').update(String(a)).digest();
  const db = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(da, db);
}

function pruneExpired(now) {
  for (const [key, entry] of pending) {
    if (entry.expiresAt <= now) pending.delete(key);
  }
}

function pruneProcessedEvents() {
  while (processedEvents.size > MAX_PROCESSED_EVENTS) {
    const oldest = processedEvents.keys().next().value; // Map preserves order
    processedEvents.delete(oldest);
  }
}

// ── Pending sessions ───────────────────────────────────────────────────────

/**
 * Create/extend a pending ad-verification session. A second call for the
 * same user+action before the first resolves overwrites/extends it.
 * @returns {{pendingKey:string, action:string, expiresAt:string}}
 */
function createPendingSession(userId, action) {
  const now = Date.now();
  const key = `${userId}|${action}`;
  const entry = {
    userId,
    action,
    issuedAt: now,
    expiresAt: now + PENDING_TTL_MS,
    verified: false
  };
  pending.set(key, entry); // overwrite / extend
  if (pending.size > MAX_PENDING_ENTRIES) pruneExpired(now);
  return {
    pendingKey: key,
    action,
    expiresAt: new Date(entry.expiresAt).toISOString()
  };
}

/**
 * Mark the most recent unverified pending session for this user (within the
 * TTL) as verified. Returns true when a session matched.
 */
function verifyLatestPending(userId, now = Date.now()) {
  let best = null;
  for (const entry of pending.values()) {
    if (entry.userId !== userId || entry.verified || entry.expiresAt <= now) continue;
    if (!best || entry.issuedAt > best.issuedAt) best = entry;
  }
  if (!best) return false;
  best.verified = true;
  return true;
}

/** Read-only status for GET /ads/status. */
function getAdStatus(userId, action) {
  const entry = pending.get(`${userId}|${action}`);
  const now = Date.now();
  if (!entry || entry.expiresAt <= now) return { pending: false, verified: false };
  return {
    pending: true,
    verified: entry.verified,
    issuedAt: new Date(entry.issuedAt).toISOString(),
    expiresAt: new Date(entry.expiresAt).toISOString(),
    expiresInSeconds: Math.max(0, Math.ceil((entry.expiresAt - now) / 1000))
  };
}

/**
 * Consume (delete) a VERIFIED pending entry for user+action. Returns false
 * when nothing verified+unexpired exists — gated actions must treat that as
 * "not unlocked".
 */
function consumeVerifiedEntry(userId, action) {
  const key = `${userId}|${action}`;
  const entry = pending.get(key);
  if (!entry || !entry.verified || entry.expiresAt <= Date.now()) return false;
  pending.delete(key);
  return true;
}

/** Test hook. */
function _resetAdGate() {
  pending.clear();
  processedEvents.clear();
}

// ── Gated-action middleware (Part B) ───────────────────────────────────────

/**
 * Middleware factory for ad-or-premium gated actions (must run AFTER
 * requireV1Scope so req.v1Auth exists).
 *
 * 1. Premium (or self-hosted key authority) → allowed, no ad needed.
 * 2. Otherwise one VERIFIED + unexpired ad session for `action` is consumed
 *    (deleted — single use) via consumeVerifiedEntry.
 * 3. Neither → 403 AD_REQUIRED telling the client to complete a rewarded ad
 *    for this action first.
 */
function requireAdOrPremium(action) {
  if (!AD_ACTIONS.includes(action)) {
    throw new Error(`requireAdOrPremium: unknown action '${action}'`);
  }
  return async (req) => {
    const auth = req.v1Auth;
    if (await checkPremium(auth)) return; // premium / self-hosted: no ad needed

    if (!consumeVerifiedEntry(auth.userId, action)) {
      throw new ApiError(403, 'AD_REQUIRED',
        `Complete a rewarded ad for the "${action}" action first ` +
        `(POST /api/v1/ads/session with action "${action}", watch the ad, then retry).`);
    }
    // Verified entry was consumed (deleted) — it cannot be reused.
  };
}

/**
 * Part C — mounted on POST /api/v1/ads/session for the raise_limit action.
 * When the caller presents a VERIFIED raise_limit reward, it is consumed
 * here and the +50 daily boost is applied (messageQuota.applyRaiseLimit) —
 * watching the ad is the ONLY way to trigger the boost; there is no separate
 * unprotected boost endpoint.
 *
 * With no verified reward the request CONTINUES (rather than 403): creating
 * or refreshing a PENDING session must stay open, otherwise the user could
 * never start the ad cycle whose callback verifies the reward. Unconditional
 * requireAdOrPremium('raise_limit') on this endpoint would deadlock the flow
 * (documented in the Part C report).
 */
function claimRaiseLimitIfVerified() {
  return async (req) => {
    const auth = req.v1Auth;
    if (!auth || !req.body || req.body.action !== 'raise_limit') return;
    if (!consumeVerifiedEntry(auth.userId, 'raise_limit')) return;
    req.adBoost = messageQuota.applyRaiseLimit(auth.userId);
  };
}

// ── Public callback endpoint ───────────────────────────────────────────────

/**
 * Handle GET /api/v1/ads/callback/:token?userId=..&eventId=..&rewards=..
 * PUBLIC (no JWT/API-key auth): the unguessable URL path is the barrier.
 * Responds plain text "[eventId]:OK" with 200 once handled.
 * @returns {boolean} true when the request was handled here.
 */
function handleAdCallback(req, res, pathname) {
  const PREFIX = '/api/v1/ads/callback/';
  if (!pathname.startsWith(PREFIX)) return false;

  try {
    // Rate-limit by source IP so the public URL cannot be hammered for free.
    const ip = (req.socket && req.socket.remoteAddress) || 'anon';
    checkRateLimit(`adcb:${ip}`, apiConfig.rateLimitWindowMs, apiConfig.rateLimitMax);
  } catch (err) {
    sendError(res, 429, 'RATE_LIMITED', 'Too many requests');
    return true;
  }

  const token = pathname.slice(PREFIX.length);
  // Wrong/missing token (or wrong method) → indistinguishable generic 404.
  if (!token || req.method !== 'GET' || !constantTimeEqual(token, callbackToken())) {
    sendError(res, 404, 'NOT_FOUND', 'Not found');
    return true;
  }

  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    sendError(res, 404, 'NOT_FOUND', 'Not found');
    return true;
  }

  const eventId = url.searchParams.get('eventId') || '';
  const userId = url.searchParams.get('userId') || '';
  const rewardsRaw = url.searchParams.get('rewards');
  const rewards = rewardsRaw && /^\d+$/.test(rewardsRaw) ? parseInt(rewardsRaw, 10) : null;

  // Without an eventId there is nothing to ack meaningfully — but we still
  // answer 200 so misconfigured retries stop. Nothing is granted.
  if (!eventId) {
    console.log('[adGate] callback without eventId (nothing granted)');
    sendAck(res, 'unknown');
    return true;
  }

  try {
    // a. Deduplicate on eventId — LevelPlay retries must never re-grant.
    if (processedEvents.has(eventId)) {
      sendAck(res, eventId);
      return true;
    }
    processedEvents.set(eventId, Date.now());
    pruneProcessedEvents();

    // b. Verify the most recent unverified pending session for this user.
    const matched = userId ? verifyLatestPending(userId) : false;
    if (!matched) {
      // Log the mismatch (never the token), still ack so LevelPlay stops.
      console.log(
        `[adGate] no matching pending session: user=${userId || '(none)'} ` +
        `event=${eventId} rewards=${rewards === null ? '(none)' : rewards}`
      );
    }

    // c. Always ack once handled.
    sendAck(res, eventId);
  } catch (err) {
    // Genuine transient error: log and let LevelPlay retry (non-200).
    console.error('[adGate] transient callback error:', err && err.message ? err.message : err);
    if (!res.headersSent) {
      sendError(res, 500, 'INTERNAL_ERROR', 'Callback processing failed');
    }
  }
  return true;
}

function sendAck(res, eventId) {
  const body = `[${eventId}]:OK`;
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

module.exports = {
  AD_ACTIONS,
  PENDING_TTL_MS,
  createPendingSession,
  verifyLatestPending,
  getAdStatus,
  consumeVerifiedEntry,
  requireAdOrPremium,
  claimRaiseLimitIfVerified,
  handleAdCallback,
  _resetAdGate
};
