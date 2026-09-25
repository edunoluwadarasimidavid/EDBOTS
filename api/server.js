/**
 * @file api/server.js
 * @description EDBOTS REST API control layer.
 *
 * Zero-dependency Node.js HTTP server (no Express) that:
 * - Mounts every route under /api (configurable in core/config).
 * - Applies CORS for the future EDBOTS App.
 * - Authenticates every route except /api/health.
 * - Rate limits per key/IP.
 * - Converts thrown ApiErrors into consistent JSON error responses.
 *
 * Security notes:
 * - Never logs or echoes API keys.
 * - Never exposes session files, credentials, or provider API keys.
 * - Fails closed: if no key is configured (env or data/apiKeys.json), every
 *   authenticated route returns 401.
 */

const http = require('http');
const config = require('./core/config');
const { Router } = require('./core/router');
const { handleCors, sendJson, readJsonBody, checkRateLimit } = require('./core/http');
const { notFound, methodNotAllowed } = require('./core/errors');

// Web pairing surface (top-level /pair routes, handled BEFORE CORS so the
// browser's own origin is irrelevant and SSE responses aren't touched).
const webPair = require('./webpair/routes');

const router = new Router();

// ── Register routes ─────────────────────────────────────────────────────
require('./routes/health').register(router);
require('./routes/status').register(router);
require('./routes/bot').register(router);
require('./routes/settings').register(router);
require('./routes/commands').register(router);
require('./routes/autoreply').register(router);
require('./routes/ai').register(router);
require('./routes/groups').register(router);
require('./routes/stats').register(router);

// ── Request handler ─────────────────────────────────────────────────────

async function handleRequest(req, res) {
  // Web pairing first — it has its own security model (pairing token), and
  // must not inherit API CORS/rate-limiting semantics. Returns false for
  // non-pairing paths so /api is unaffected.
  if (webPair.handle(req, res)) return;
  // CORS (also short-circuits OPTIONS preflight)
  if (handleCors(req, res, config.corsOrigins)) return;

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // Only serve the configured base path
    if (pathname === config.basePath || pathname === `${config.basePath}/`) {
      return sendJson(res, 200, {
        ok: true,
        service: config.name,
        version: config.version,
        endpoints: [
          'GET /api/health',
          'GET /pair (web pairing UI)',
          'GET /api/status',
          'POST /api/bot/start',
          'POST /api/bot/stop',
          'GET /api/settings',
          'PATCH /api/settings',
          'GET /api/commands',
          'POST /api/commands/{name}/enable',
          'POST /api/commands/{name}/disable',
          'GET /api/commands/group/{groupId}',
          'POST /api/commands/group/{groupId}/enable',
          'POST /api/commands/group/{groupId}/disable',
          'GET /api/autoreply',
          'PATCH /api/autoreply',
          'GET /api/autoreply/chat/{chatId}',
          'PATCH /api/autoreply/chat/{chatId}',
          'POST /api/autoreply/chat/{chatId}/keywords',
          'DELETE /api/autoreply/chat/{chatId}/keywords/{keyword}',
          'GET /api/ai',
          'PATCH /api/ai',
          'GET /api/groups',
          'GET /api/groups/{groupId}/settings',
          'PATCH /api/groups/{groupId}/settings',
          'GET /api/stats'
        ]
      });
    }

    if (!pathname.startsWith(`${config.basePath}/`)) {
      throw notFound('Unknown resource. API is mounted at /api');
    }

    const routePath = pathname.slice(config.basePath.length) || '/';
    const match = router.match(req.method, routePath);

    if (!match) {
      if (router.hasPath(routePath)) throw methodNotAllowed();
      throw notFound(`No route for ${req.method} ${pathname}`);
    }

    // Parse body for methods that can carry one
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      req.body = await readJsonBody(req, config.maxBodyBytes);
    } else {
      req.body = {};
    }

    // Rate limit per authenticated identity or IP
    const clientId = (req.headers['x-api-key'] || req.socket.remoteAddress || 'anon').toString();
    checkRateLimit(clientId, config.rateLimitWindowMs, config.rateLimitMax);

    await router.dispatch(match.handlers, req, res, match.params);
  } catch (err) {
    handleError(res, err);
  }
}

// ── Error responses ─────────────────────────────────────────────────────

function handleError(res, err) {
  if (err instanceof (require('./core/errors').ApiError)) {
    const headers = {};
    if (err.retryAfter) headers['Retry-After'] = String(err.retryAfter);
    return sendJson(res, err.status, {
      ok: false,
      error: { code: err.code, message: err.message, details: err.details || undefined }
    }, headers);
  }

  // Unexpected error: log server-side, return a generic message
  console.error('[API] Unhandled error:', err);
  if (!res.headersSent) {
    sendJson(res, 500, {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    });
  }
}

// ── Server bootstrap ────────────────────────────────────────────────────

// Idempotent: multiple entrypoints (index.js, core/connection.js, the CLI)
// all call start(); only the first actually binds. This used to crash with
// EADDRINUSE because each caller kept its own "already started" flag.
let activeServer = null;

function start() {
  if (activeServer && activeServer.listening) {
    return activeServer;
  }

  const server = http.createServer(handleRequest);

  server.on('clientError', (err, socket) => {
    try {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
    } catch {
      /* socket already gone */
    }
  });

  // Bind failures (EADDRINUSE, EACCES…) must never kill the bot: the API is
  // an additive control layer. Log once and keep the process alive.
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(
        `\x1b[33m[API] Port ${config.port} already in use — API/web pairing already running. Bot continues.\x1b[0m`
      );
    } else {
      console.error('\x1b[31m[API] Server error (bot continues):\x1b[0m', err && err.message ? err.message : err);
    }
  });

  server.listen(config.port, config.host, () => {
    console.log(
      `\x1b[36m[API] ${config.name} v${config.version} listening on http://${config.host}:${config.port}${config.basePath}\x1b[0m`
    );
    if (!config.masterKey) {
      console.log(
        '\x1b[33m[API] EDBOTS_API_KEY not set — create per-user keys with: node api/createKey.js <owner> [scopes]\x1b[0m'
      );
    }
  });

  activeServer = server;
  return server;
}

// Allow both `node api/server.js` and require() from the bot entrypoint
if (require.main === module) {
  // Load env for standalone runs, mirroring the bot's entrypoint behavior
  require('dotenv').config();
  start();
}

module.exports = { start, handleRequest };
