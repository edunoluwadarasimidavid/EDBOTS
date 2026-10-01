/**
 * @file api/v1/routes.js
 * @description The /api/v1 route table. Every standard route delegates to the
 * EXISTING /api handler chain (router.match + dispatch) — service logic is
 * reused, never duplicated. Responses are re-shaped by v1/respond.js.
 *
 * Gap endpoints (existed only as WhatsApp owner commands or not at all):
 * - POST /api/v1/bot/restart   → graceful same-process restart (socket
 *   reconnect only; never process.exit on API request)
 * - GET  /api/v1/pair/qr       → current QR (PNG data-URL) behind API auth
 * - POST /api/v1/pair/phone    → pairing-code request behind API auth, with
 *   a per-user cooldown + validity TTL (Phase 3 hardening base)
 * - POST /api/v1/pair/reset    → reset pairing state behind API auth
 */

const { Router } = require('../core/router');
const botState = require('../../core/botState');
const authEvents = require('../../core/authEvents');
const { requireV1Scope, requirePremium, checkPremium } = require('./auth');
const { requireAdOrPremium, claimRaiseLimitIfVerified } = require('./adGate');
const messageQuota = require('./messageQuota');
const { runV1, sendSuccess, sendError } = require('./respond'); // sendError used by handleV1
const adGate = require('./adGate');
const { ApiError } = require('../core/errors');

// ── Pairing cooldown / TTL (per user; in-memory, Phase 3 will extend) ─────
const PAIRING_COOLDOWN_MS = parseInt(process.env.EDBOTS_V1_PAIR_COOLDOWN_MS || '60000', 10);
const pairingRequests = new Map(); // userId → lastRequestAt (ms)

function assertPairingCooldown(userId) {
  const now = Date.now();
  const last = pairingRequests.get(userId) || 0;
  const remainingMs = last + PAIRING_COOLDOWN_MS - now;
  if (remainingMs > 0) {
    const err = new ApiError(429, 'TOO_MANY_REQUESTS',
      `Pairing code was already requested. Try again in ${Math.ceil(remainingMs / 1000)}s.`);
    err.retryAfter = Math.ceil(remainingMs / 1000);
    throw err;
  }

  // Opportunistic cleanup
  if (pairingRequests.size > 5000) {
    for (const [uid, ts] of pairingRequests) {
      if (now - ts > 24 * 60 * 60 * 1000) pairingRequests.delete(uid);
    }
  }
}

/** Record a successful pairing request (cooldown engages ONLY on success —
 * a SOCKET_NOT_READY failure must not lock the user out of retrying). */
function recordPairingRequest(userId) {
  pairingRequests.set(userId, Date.now());
}

// ── Delegating v1 route table ───────────────────────────────────────────────
//
// v1 path (relative to /api/v1)     → legacy /api path + methods
// ---------------------------------------------------------------------
// /health                           → GET  /health                (public)
// /status                           → GET  /status
// /stats                            → GET  /stats
// /bot/start                        → POST /bot/start
// /bot/stop                         → POST /bot/stop
// /settings                         → GET|PATCH /settings
// /commands                         → GET  /commands
// /commands/:name/enable            → POST /commands/:name/enable
// /commands/:name/disable           → POST /commands/:name/disable
// /commands/group/:groupId          → GET  /commands/group/:groupId
// /commands/group/:groupId/enable   → POST /commands/group/:groupId/enable
// /commands/group/:groupId/disable  → POST /commands/group/:groupId/disable
// /autoreply                        → GET|PATCH /autoreply
// /autoreply/chat/:chatId           → GET|PATCH /autoreply/chat/:chatId
// /autoreply/chat/:chatId/keywords     → POST (add keyword)
// /autoreply/chat/:chatId/keywords/:keyword → DELETE
// /ai                               → GET|PATCH /ai
// /groups                           → GET  /groups
// /groups/:groupId/settings         → GET|PATCH /groups/:groupId/settings

const DELEGATIONS = [
  // [v1Method, v1Path, legacyMethod, legacyPath, ...middlewares]
  ['GET', '/health', 'GET', '/health'], // public — handled specially (no auth)
  ['GET', '/status', 'GET', '/status', requireV1Scope('read')],
  ['GET', '/stats', 'GET', '/stats', requireV1Scope('read')],
  // Bot start/stop are ad-or-premium gated (Part B): free users must spend
  // one verified rewarded-ad session per call; premium users bypass.
  ['POST', '/bot/start', 'POST', '/bot/start', requireV1Scope('write'), requireAdOrPremium('start_bot')],
  ['POST', '/bot/stop', 'POST', '/bot/stop', requireV1Scope('write'), requireAdOrPremium('stop_bot')],
  ['GET', '/settings', 'GET', '/settings', requireV1Scope('read')],
  ['PATCH', '/settings', 'PATCH', '/settings', requireV1Scope('write')],
  ['GET', '/commands', 'GET', '/commands', requireV1Scope('read')],
  ['POST', '/commands/:name/enable', 'POST', '/commands/:name/enable', requireV1Scope('write')],
  ['POST', '/commands/:name/disable', 'POST', '/commands/:name/disable', requireV1Scope('write')],
  ['GET', '/commands/group/:groupId', 'GET', '/commands/group/:groupId', requireV1Scope('read')],
  ['POST', '/commands/group/:groupId/enable', 'POST', '/commands/group/:groupId/enable', requireV1Scope('write')],
  ['POST', '/commands/group/:groupId/disable', 'POST', '/commands/group/:groupId/disable', requireV1Scope('write')],
  ['GET', '/autoreply', 'GET', '/autoreply', requireV1Scope('read')],
  ['PATCH', '/autoreply', 'PATCH', '/autoreply', requireV1Scope('write')],
  ['GET', '/autoreply/chat/:chatId', 'GET', '/autoreply/chat/:chatId', requireV1Scope('read')],
  ['PATCH', '/autoreply/chat/:chatId', 'PATCH', '/autoreply/chat/:chatId', requireV1Scope('write')],
  ['POST', '/autoreply/chat/:chatId/keywords', 'POST', '/autoreply/chat/:chatId/keywords', requireV1Scope('write')],
  ['DELETE', '/autoreply/chat/:chatId/keywords/:keyword', 'DELETE', '/autoreply/chat/:chatId/keywords/:keyword', requireV1Scope('write')],
  ['GET', '/ai', 'GET', '/ai', requireV1Scope('read')],
  // Changing AI settings is the premium-gated control (free users get 403
  // FORBIDDEN; self-hosted API keys are always allowed).
  ['PATCH', '/ai', 'PATCH', '/ai', requireV1Scope('write'), requirePremium()],
  ['GET', '/groups', 'GET', '/groups', requireV1Scope('read')],
  ['GET', '/groups/:groupId/settings', 'GET', '/groups/:groupId/settings', requireV1Scope('read')],
  ['PATCH', '/groups/:groupId/settings', 'PATCH', '/groups/:groupId/settings', requireV1Scope('write')]
];

/**
 * Build the v1 router. `legacyRouter` is the existing /api Router instance —
 * v1 re-dispatches through it so legacy middleware (auth, validation,
 * handlers) runs unchanged and only the envelope differs.
 */
function createV1Router(legacyRouter) {
  const v1 = new Router();

  // Substitute :param values from the v1 match into the legacy path pattern
  // (v1 and legacy param names are identical by construction).
  function materializeLegacyPath(pattern, params) {
    if (!pattern.includes(':')) return pattern;
    return pattern
      .split('/')
      .map((seg) => (seg.startsWith(':') ? String((params || {})[seg.slice(1)] ?? seg) : seg))
      .join('/');
  }

  // Run ONLY the legacy route's final handler (skip its requireScope auth
  // middleware: v1 auth already ran, and the legacy middleware only knows
  // API keys — it would wrongly reject Appwrite JWTs).
  async function runLegacyHandler(legacyRouter2, method, pattern, req, res, params) {
    const actualPath = materializeLegacyPath(pattern, params);
    const match = legacyRouter2.match(method, actualPath);
    if (!match) throw new ApiError(404, 'NOT_FOUND', 'Route not found');
    const handler = match.handlers[match.handlers.length - 1];
    await handler(req, res, match.params);
  }

  // ── Health (public, mirrors legacy /api/health behavior) ───────────────
  v1.get('/health', async (req, res) => {
    await runV1(res, async () => {
      await runLegacyHandler(legacyRouter, 'GET', '/health', req, res, {});
    });
  });

  // ── Delegated routes ───────────────────────────────────────────────────
  for (const [method, v1Path, legacyMethod, legacyPath, ...middlewares] of DELEGATIONS) {
    if (v1Path === '/health') continue; // registered above, public

    v1[method.toLowerCase()](v1Path, ...middlewares, async (req, res) => {
      await runV1(res, async () => {
        await runLegacyHandler(legacyRouter, legacyMethod, legacyPath, req, res, req.params);
      });
    });
  }

  // ── Gap endpoint: POST /api/v1/bot/restart ─────────────────────────────
  // Graceful, same-process restart. NEVER process.exit() — an API caller
  // must not be able to kill the host process (the WhatsApp `.restart`
  // command's pm2/exit behavior is intentionally NOT replicated).
  //
  // Semantics:
  // - online/connecting → close the socket with the stop flag flipped on
  //   and straight back off, so connection.js's close handler performs the
  //   reconnect (exactly ONE reconnect path — we do NOT also call
  //   connectToWhatsApp() here, which would race a second socket).
  // - offline but API-stopped → clear the flag and kick a reconnect.
  // - offline and never started → no-op 200 pointing at /bot/start (an API
  //   "restart" must not silently boot a fresh WhatsApp connection).
  // Part B decision: restart IS gated (requireAdOrPremium('start_bot')).
  // Rationale: its offline-but-API-stopped branch boots a WhatsApp
  // connection — identical to start_bot — so leaving it ungated would let a
  // free user bypass the start_bot ad by restarting after anyone else's API
  // stop. Restart is semantically stop+start, so it spends a start_bot ad.
  v1.post('/bot/restart', requireV1Scope('write'), requireAdOrPremium('start_bot'), async (req, res) => {
    await runV1(res, async () => {
      const before = botState.getSnapshot().status;

      if (before === 'online' || before === 'connecting') {
        botState.requestStop();  // closes socket, sets stoppedByApi
        botState.requestStart(); // clear flag immediately: close → reconnect
        return sendSuccess(res, {
          action: 'restart',
          previousStatus: before,
          status: 'connecting',
          message: 'Restart in progress. Poll GET /api/v1/status for the connection result.'
        }, 202);
      }

      if (botState.isStopped()) {
        botState.requestStart();
        const { connectToWhatsApp } = require('../../core/connection');
        connectToWhatsApp().catch((err) => {
          console.error('[API v1] restart reconnect failed:', err && err.message);
        });
        return sendSuccess(res, {
          action: 'restart',
          previousStatus: before,
          status: 'connecting',
          message: 'Restart requested. Poll GET /api/v1/status for the connection result.'
        }, 202);
      }

      sendSuccess(res, {
        action: 'restart',
        previousStatus: before,
        status: botState.getSnapshot().status,
        message: 'Bot is not running and was not stopped via API. Use POST /api/v1/bot/start.'
      }, 200);
    });
  });

  // ── Gap endpoint: GET /api/v1/pair/qr ─────────────────────────────────
  // Current QR as a PNG data-URL (only when state is QR_READY). The RAW QR
  // string is never exposed — only the rendered image, exactly like /pair.
  v1.get('/pair/qr', requireV1Scope('read'), async (req, res) => {
    await runV1(res, async () => {
      const snap = authEvents.getSnapshot();
      if (!snap.qrImage) {
        throw new ApiError(404, 'NOT_FOUND', 'No QR code is available right now (state: '
          + `${snap.state}). QR codes appear only while waiting for authentication.`);
      }
      sendSuccess(res, {
        qrImage: snap.qrImage,
        qrUpdatedAt: snap.qrUpdatedAt,
        state: snap.state
      });
    });
  });

  // ── Gap endpoint: POST /api/v1/pair/phone ─────────────────────────────
  // Phone-number pairing code request behind API auth. Cooldown per user
  // (Phase 3.6 base): one request per PAIRING_COOLDOWN_MS per userId.
  v1.post('/pair/phone', requireV1Scope('write'), async (req, res) => {
    await runV1(res, async () => {
      // Validate BEFORE the cooldown check (bad input must not burn it).
      const raw = String((req.body && req.body.phoneNumber) || '');
      const digits = raw.replace(/[^0-9]/g, '');
      if (digits.length < 8 || digits.length > 15) {
        throw new ApiError(400, 'VALIDATION_ERROR',
          'phoneNumber must be 8–15 digits including country code (e.g. 2348012345678).',
          [{ field: 'phoneNumber', message: 'must be 8–15 digits including country code' }]);
      }
      if (req.body && Object.keys(req.body).some((k) => k !== 'phoneNumber')) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Only "phoneNumber" is accepted.',
          [{ field: [...Object.keys(req.body)].find((k) => k !== 'phoneNumber'), message: 'is not an accepted field' }]);
      }

      assertPairingCooldown(req.v1Auth.userId);

      const result = botState.requestWebPairing(digits);
      if (!result.ok) {
        throw new ApiError(result.status,
          result.code === 'ALREADY_CONNECTED' ? 'ALREADY_CONNECTED' : 'SOCKET_NOT_READY',
          result.message);
      }
      recordPairingRequest(req.v1Auth.userId);

      // The actual code arrives via authEvents (SSE on /pair/events and
      // GET /api/v1/pair/status). 202 = accepted, still in progress.
      sendSuccess(res, {
        message: 'Pairing code requested. Poll GET /api/v1/pair/status for the code.',
        state: authEvents.getState(),
        cooldownMs: PAIRING_COOLDOWN_MS
      }, 202);
    });
  });

  // ── Gap endpoint: GET /api/v1/pair/status ─────────────────────────────
  // Poll-friendly pairing snapshot (code + QR) behind API auth instead of
  // SSE, for mobile clients.
  v1.get('/pair/status', requireV1Scope('read'), async (req, res) => {
    await runV1(res, async () => {
      const authSnap = authEvents.getSnapshot();
      const botSnap = botState.getSnapshot();
      sendSuccess(res, {
        auth: authSnap,
        bot: {
          status: botSnap.status,
          online: botSnap.status === 'online',
          user: botSnap.user
        }
      });
    });
  });

  // ── Gap endpoint: POST /api/v1/pair/reset ─────────────────────────────
  v1.post('/pair/reset', requireV1Scope('write'), async (req, res) => {
    await runV1(res, async () => {
      authEvents.setState('WAITING_FOR_AUTH');
      sendSuccess(res, { message: 'Pairing state reset.' });
    });
  });

  // ── LevelPlay rewarded-ad gate ────────────────────────────────────────
  // (The public GET /api/v1/ads/callback/:token is intercepted in
  // api/server.js BEFORE dispatch — see adGate.handleAdCallback.)
  // Part C: for action "raise_limit", a VERIFIED reward is consumed right
  // here and raises the user's daily message ceiling by +50 (ad watching is
  // the only boost path). Without a verified reward the session is simply
  // created/refreshed — the pending state is what the S2S callback verifies.
  v1.post('/ads/session', requireV1Scope('write'), claimRaiseLimitIfVerified(), async (req, res) => {
    await runV1(res, async () => {
      const body = req.body || {};
      const action = body.action;
      const unknownFields = Object.keys(body).filter((k) => { const k2 = k; return k2 !== 'action'; });
      if (!action || typeof action !== 'string' || !adGate.AD_ACTIONS.includes(action)) {
        throw new ApiError(400, 'VALIDATION_ERROR',
          `action must be one of: ${adGate.AD_ACTIONS.join(', ')}`,
          [{ field: 'action', message: !action ? 'is required' : 'must be one of: ' + adGate.AD_ACTIONS.join(', ') }]);
      }
      if (unknownFields.length > 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Only "action" is accepted.',
          [{ field: unknownFields[0], message: 'is not an accepted field' }]);
      }
      const session = adGate.createPendingSession(req.v1Auth.userId, action);
      // Part C: surface the +50 boost when this call consumed a verified
      // raise_limit reward (single round trip for watch → verify → boost).
      if (req.adBoost) {
        return sendSuccess(res, { ...session, boostApplied: true, newCeiling: req.adBoost.ceiling });
      }
      sendSuccess(res, session, 200);
    });
  });

  v1.get('/ads/status', requireV1Scope('read'), async (req, res) => {
    await runV1(res, async () => {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const action = url.searchParams.get('action') || '';
      if (!adGate.AD_ACTIONS.includes(action)) {
        throw new ApiError(400, 'VALIDATION_ERROR',
          `query "action" must be one of: ${adGate.AD_ACTIONS.join(', ')}`,
          [{ field: 'action', message: 'must be one of: ' + adGate.AD_ACTIONS.join(', ') }]);
      }
      sendSuccess(res, { action, ...adGate.getAdStatus(req.v1Auth.userId, action) });
    });
  });

  // ── Part C: GET /api/v1/usage ─────────────────────────────────────────
  // Per-user daily message-quota view so the app can render "80/100" and
  // prompt for a raise_limit ad before the wall is hit.
  v1.get('/usage', requireV1Scope('read'), async (req, res) => {
    await runV1(res, async () => {
      const auth = req.v1Auth;
      const premium = auth.isAppwrite ? await checkPremium(auth) : true;
      sendSuccess(res, messageQuota.getUsage(auth.userId, premium));
    });
  });

  return v1;
}

// ── Request entry point (mounted from api/server.js) ─────────────────────
//
// handleV1(legacyRouter, req, res, pathname) → true when handled.
// `pathname` is the FULL request path (e.g. /api/v1/status).
// Runs its own body parsing + the legacy global rate limit because the v1
// namespace is dispatched before the legacy pipeline reaches those steps.

const { readJsonBody, checkRateLimit } = require('../core/http');
const apiConfig = require('../core/config');

async function handleV1(legacyRouter, req, res, pathname) {
  const V1_BASE = '/api/v1';
  if (!pathname.startsWith(V1_BASE)) return false;

  const routePath = pathname.slice(V1_BASE.length) || '/';

  // Lazy singleton so tests and runtime share one router.
  createV1RouterOnce(legacyRouter);

  const match = v1Router.match(req.method, routePath);
  if (!match) {
    if (v1Router.hasPath(routePath)) {
      // The fixed v1 code set has no METHOD_NOT_ALLOWED: report as NOT_FOUND
      // (no such endpoint for this method) while keeping the message explicit.
      sendError(res, 404, 'NOT_FOUND', `Method ${req.method} not allowed for ${pathname}`);
      return true;
    }
    sendError(res, 404, 'NOT_FOUND', `No /api/v1 route for ${req.method} ${pathname}`);
    return true;
  }

  try {
    // Body parsing (same size cap as legacy) for methods that carry one.
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      req.body = await readJsonBody(req, apiConfig.maxBodyBytes);
    } else {
      req.body = {};
    }

    // Same global rate limit window as the legacy API (Phase 3 adds
    // per-user and per-endpoint-class policies on top of this).
    const clientId = (req.headers['x-api-key'] || req.socket.remoteAddress || 'anon').toString();
    checkRateLimit(clientId, apiConfig.rateLimitWindowMs, apiConfig.rateLimitMax);

    await v1Router.dispatch(match.handlers, req, res, match.params);
  } catch (err) {
    // Top-level guarantee: nothing escapes the v1 envelope (hardening 3.4).
    const { sendApiErrorV1 } = require('./respond');
    sendApiErrorV1(res, err);
  }
  return true;
}

let v1Router = null;
function createV1RouterOnce(legacyRouter) {
  if (!v1Router) v1Router = createV1Router(legacyRouter);
  return v1Router;
}

/** Test hook: forget the built router. */
function _resetV1Router() {
  v1Router = null;
}

module.exports = {
  handleV1,
  createV1Router,
  _resetV1Router,
  assertPairingCooldown,
  recordPairingRequest,
  PAIRING_COOLDOWN_MS,
  // Rewarded-ad gate surface (used by app-facing features and tests)
  createAdSession: (userId, action) => adGate.createPendingSession(userId, action),
  getAdStatus: (userId, action) => adGate.getAdStatus(userId, action),
  consumeAdReward: (userId, action) => adGate.consumeVerifiedEntry(userId, action),
  AD_ACTIONS: adGate.AD_ACTIONS
};
