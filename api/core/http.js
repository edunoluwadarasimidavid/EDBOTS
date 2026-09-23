/**
 * @file api/core/http.js
 * @description HTTP plumbing for the zero-dependency API layer:
 * CORS, body parsing, JSON responses, and per-client rate limiting.
 */

const crypto = require('crypto');
const { ApiError, tooManyRequests, payloadTooLarge } = require('./errors');

// ── CORS ────────────────────────────────────────────────────────────────

function buildCorsHeaders(req, allowedOrigins) {
  const origin = req.headers.origin || '';
  const allowAll = allowedOrigins.includes('*');

  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
    'Access-Control-Max-Age': '600'
  };

  if (allowAll) {
    headers['Access-Control-Allow-Origin'] = '*';
  } else if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }

  return headers;
}

/**
 * Attach CORS headers; returns true if this was a preflight that is fully
 * handled (caller should respond 204 and stop).
 */
function handleCors(req, res, allowedOrigins) {
  const headers = buildCorsHeaders(req, allowedOrigins);
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}

// ── Responses ───────────────────────────────────────────────────────────

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders
  });
  res.end(body);
}

// ── Body parsing ────────────────────────────────────────────────────────

/**
 * Read and parse a JSON body with size limits.
 * Empty bodies resolve to {} so POST endpoints can have optional bodies.
 */
function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(payloadTooLarge());
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return reject(new ApiError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object'));
        }
        resolve(parsed);
      } catch (err) {
        reject(new ApiError(400, 'INVALID_JSON', 'Request body is not valid JSON'));
      }
    });

    req.on('error', (err) => reject(new ApiError(502, 'BAD_REQUEST_STREAM', 'Failed to read request body')));
  });
}

// ── Rate limiting (in-memory, per key or IP) ────────────────────────────

const buckets = new Map();

function checkRateLimit(clientId, windowMs, max) {
  const now = Date.now();
  let bucket = buckets.get(clientId);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    bucket = { windowStart: now, count: 0 };
    buckets.set(clientId, bucket);
  }

  bucket.count += 1;

  // Opportunistic cleanup so the map cannot grow unbounded
  if (buckets.size > 5000) {
    for (const [key, b] of buckets) {
      if (now - b.windowStart >= windowMs) buckets.delete(key);
    }
  }

  if (bucket.count > max) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.windowStart + windowMs - now) / 1000));
    throw tooManyRequests('Rate limit exceeded. Slow down.', retryAfterSec);
  }
}

module.exports = {
  handleCors,
  sendJson,
  readJsonBody,
  checkRateLimit
};
