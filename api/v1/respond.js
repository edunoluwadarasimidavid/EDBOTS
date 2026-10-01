/**
 * @file api/v1/respond.js
 * @description The /api/v1 response contract:
 *   success: {"success":true,"data":{...},"error":null}
 *   failure: {"success":false,"data":null,"error":{"code":"STABLE_CODE","message":"...","details"?}}
 *
 * Fixed error codes (v1 contract):
 *   UNAUTHORIZED, FORBIDDEN, BOT_NOT_CONNECTED, NOT_FOUND, VALIDATION_ERROR,
 *   RATE_LIMITED, CONFLICT, INTERNAL_ERROR
 *
 * Reuse strategy: v1 endpoints re-run the EXISTING /api route handlers, whose
 * responses are captured via a short-lived res.writeHead/res.end override,
 * unwrapped from the legacy {ok,...}/{ok:false,error} shapes, and re-wrapped
 * in the v1 envelope. Service logic is never duplicated.
 *
 * No-leak rule: any error that is not a recognized ApiError becomes
 * INTERNAL_ERROR with a generic message; internals are logged server-side only.
 */

const { ApiError } = require('../core/errors');
const { sendJson } = require('../core/http');

/** The only error codes a v1 response may carry. */
const V1_ERROR_CODES = new Set(
  [
    'UNAUTHORIZED',
    'FORBIDDEN',
    'BOT_NOT_CONNECTED',
    'NOT_FOUND', 'VALIDATION_ERROR',
    'RATE_LIMITED',
    'CONFLICT',
    'INTERNAL_ERROR',
    'AD_REQUIRED', // Part B: rewarded-ad gate (403) — set by adGate.js
    'LIMIT_EXCEEDED' // Part C: daily message quota (403) — set by messageQuota via handler
  ]
);

/** Map legacy ApiError codes/statuses onto the fixed v1 codes. */
function mapErrorCode(status, legacyCode) {
  switch (legacyCode) {
    case 'UNAUTHORIZED':
    case 'PAIRING_TOKEN_REQUIRED':
      return 'UNAUTHORIZED';
    case 'FORBIDDEN':
      return 'FORBIDDEN';
    case 'NOT_FOUND':
      return 'NOT_FOUND';
    case 'VALIDATION_ERROR':
    case 'INVALID_JSON':
    case 'INVALID_PHONE':
    case 'PAYLOAD_TOO_LARGE':
    case 'BAD_REQUEST_STREAM':
      return 'VALIDATION_ERROR';
    case 'TOO_MANY_REQUESTS':
      return 'RATE_LIMITED';
    case 'CONFLICT':
    case 'ALREADY_CONNECTED':
      return 'CONFLICT';
    case 'SOCKET_NOT_READY':
      return 'BOT_NOT_CONNECTED';
    case 'AD_REQUIRED': // thrown by adGate middleware — must survive mapping
      return 'AD_REQUIRED';
    case 'LIMIT_EXCEEDED': // thrown by messageQuota paths — must survive mapping
      return 'LIMIT_EXCEEDED';
    default:
      // 5xx of any other flavor (Appwrite down, storage failure, ...) → generic
      return status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR';
  }
}

// ── Envelope senders ───────────────────────────────────────────────────────

function sendSuccess(res, data, status = 200, extraHeaders = {}) {
  sendJson(res, status, { success: true, data, error: null }, extraHeaders);
}

function sendError(res, status, code, message, details, extraHeaders = {}) {
  if (!V1_ERROR_CODES.has(code)) code = 'INTERNAL_ERROR';
  const error = { code, message };
  if (details !== undefined && details !== null) error.details = details;
  sendJson(res, status, { success: false, data: null, error }, extraHeaders);
}

/** Convert a thrown error (ApiError or anything else) into a v1 failure. */
function sendApiErrorV1(res, err) {
  if (err instanceof ApiError) {
    const code = mapErrorCode(err.status, err.code);
    const headers = err.retryAfter ? { 'Retry-After': String(err.retryAfter) } : {};
    const error = { code, message: err.message };
    if (err.details !== undefined && err.details !== null) error.details = err.details;
    sendJson(res, err.status, { success: false, data: null, error }, headers);
    return;
  }
  // Unexpected: log server-side, return ONLY the public shape.
  console.error('[API v1] Unexpected error:', err && err.stack ? err.stack : err);
  if (!res.headersSent) {
    sendJson(res, 500, {
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    });
  }
}

// ── Response capture (legacy handler → v1 envelope) ────────────────────────

/**
 * Temporarily override res.writeHead/res.end so a legacy handler's
 * sendJson(...) call is captured instead of sent.
 */
function captureJsonResponse(res) {
  const state = { status: null, headers: null, body: null };
  const origWriteHead = res.writeHead;
  const origEnd = res.end;

  res.writeHead = function patchedWriteHead(status, headers) {
    state.status = status;
    state.headers = headers;
    return res;
  };
  res.end = function patchedEnd(body) {
    state.body = body;
    return res;
  };

  return {
    hasResponse: () => state.status !== null,
    get: () => ({ status: state.status, headers: state.headers, body: state.body }),
    restore: () => {
      res.writeHead = origWriteHead;
      res.end = origEnd;
    }
  };
}

/** Re-emit a captured legacy payload in the v1 envelope. */
function sendFromLegacy(res, oldStatus, rawBody) {
  let payload = {};
  try {
    payload = rawBody ? JSON.parse(String(rawBody)) : {};
  } catch {
    payload = {};
  }

  // Already v1-shaped (gap endpoints call sendSuccess/sendError inside
  // runV1) → pass through untouched instead of double-wrapping.
  if (payload && typeof payload === 'object' && typeof payload.success === 'boolean') {
    const headers = oldStatus === 429 && payload.error && payload.error.code === 'RATE_LIMITED'
      ? { 'Retry-After': '60' }
      : {};
    sendJson(res, oldStatus, payload, headers);
    return;
  }

  if (oldStatus >= 400) {
    const legacy = (payload && payload.error) || {};
    const code = mapErrorCode(oldStatus, legacy.code);
    const error = {
      code,
      message: legacy.message || 'Request failed'
    };
    if (legacy.details !== undefined && legacy.details !== null) error.details = legacy.details;
    const headers = oldStatus === 429 ? { 'Retry-After': '60' } : {};
    sendJson(res, oldStatus, { success: false, data: null, error }, headers);
    return;
  }

  const data = { ...payload };
  delete data.ok; // legacy marker never appears in v1 payloads
  sendJson(res, oldStatus, { success: true, data, error: null });
}

/**
 * Run `fn` (legacy middleware chain + handler) and guarantee a v1-shaped
 * response no matter what happens.
 */
async function runV1(res, fn) {
  const cap = captureJsonResponse(res);
  try {
    await fn();

    if (cap.hasResponse()) {
      const { status, body } = cap.get();
      cap.restore();
      if (status === null || status === undefined) {
        sendError(res, 500, 'INTERNAL_ERROR', 'Handler produced no status');
        return;
      }
      sendFromLegacy(res, status, body);
      return;
    }

    // Handler neither responded nor threw — never leave the client hanging.
    cap.restore();
    sendError(res, 500, 'INTERNAL_ERROR', 'Handler produced no response');
  } catch (err) {
    cap.restore();
    sendApiErrorV1(res, err);
  }
}

module.exports = {
  V1_ERROR_CODES,
  mapErrorCode,
  sendSuccess,
  sendError,
  sendApiErrorV1,
  sendFromLegacy,
  captureJsonResponse,
  runV1
};
