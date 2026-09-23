/**
 * @file api/core/errors.js
 * @description Typed API errors with stable machine-readable codes.
 */

class ApiError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} code machine-readable code (e.g. VALIDATION_ERROR)
   * @param {string} message human-readable message
   * @param {Array<{field?: string, message: string}>} [details]
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (message, details) => new ApiError(400, 'VALIDATION_ERROR', message, details);
const unauthorized = (message = 'Missing or invalid API key') => new ApiError(401, 'UNAUTHORIZED', message);
const forbidden = (message = 'Your API key is not allowed to perform this action') =>
  new ApiError(403, 'FORBIDDEN', message);
const notFound = (message = 'Resource not found') => new ApiError(404, 'NOT_FOUND', message);
const methodNotAllowed = (message = 'Method not allowed for this endpoint') =>
  new ApiError(405, 'METHOD_NOT_ALLOWED', message);
const conflict = (message) => new ApiError(409, 'CONFLICT', message);
const payloadTooLarge = (message = 'Request body too large') =>
  new ApiError(413, 'PAYLOAD_TOO_LARGE', message);
const tooManyRequests = (message = 'Too many requests', retryAfterSec = 60) =>
  new ApiError(429, 'TOO_MANY_REQUESTS', message).withRetryAfter(retryAfterSec);
const serviceUnavailable = (message) => new ApiError(503, 'SERVICE_UNAVAILABLE', message);

ApiError.prototype.withRetryAfter = function (seconds) {
  this.retryAfter = seconds;
  return this;
};

module.exports = {
  ApiError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  methodNotAllowed,
  conflict,
  payloadTooLarge,
  tooManyRequests,
  serviceUnavailable
};
