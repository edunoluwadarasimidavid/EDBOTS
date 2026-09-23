/**
 * @file api/core/validate.js
 * @description Tiny declarative request-body validator.
 *
 * Rules:
 *   { field: { type: 'boolean'|'string'|'number'|'array', required?, enum?, min?, max?, maxLen?, pattern? } }
 *
 * Throws a 400 ApiError with per-field details on failure.
 * Unknown fields are rejected to keep the control surface strict.
 */

const { badRequest } = require('./errors');

/**
 * Validate a parsed JSON body against a schema.
 * @param {object} body parsed request body (always an object)
 * @param {object} schema field rules
 * @returns {object} sanitized body containing ONLY schema fields that were present
 */
function validateBody(body, schema) {
  const details = [];
  const result = {};

  for (const [field, rule] of Object.entries(schema)) {
    const value = body[field];

    if (value === undefined) {
      if (rule.required) details.push({ field, message: `'${field}' is required` });
      continue;
    }

    if (value === null) {
      details.push({ field, message: `'${field}' must not be null` });
      continue;
    }

    switch (rule.type) {
      case 'boolean':
        if (typeof value !== 'boolean') {
          details.push({ field, message: `'${field}' must be a boolean` });
          break;
        }
        result[field] = value;
        continue;

      case 'string': {
        if (typeof value !== 'string') {
          details.push({ field, message: `'${field}' must be a string` });
          break;
        }
        const trimmed = value.trim();
        if (trimmed === '') {
          details.push({ field, message: `'${field}' must not be empty` });
          break;
        }
        if (rule.maxLen && trimmed.length > rule.maxLen) {
          details.push({ field, message: `'${field}' exceeds max length ${rule.maxLen}` });
          break;
        }
        if (rule.pattern && !rule.pattern.test(trimmed)) {
          details.push({ field, message: rule.patternMessage || `'${field}' has an invalid format` });
          break;
        }
        if (rule.enum && !rule.enum.includes(trimmed)) {
          details.push({ field, message: `'${field}' must be one of: ${rule.enum.join(', ')}` });
          break;
        }
        result[field] = trimmed;
        continue;
      }

      case 'number': {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          details.push({ field, message: `'${field}' must be a number` });
          break;
        }
        if (rule.min !== undefined && value < rule.min) {
          details.push({ field, message: `'${field}' must be >= ${rule.min}` });
          break;
        }
        if (rule.max !== undefined && value > rule.max) {
          details.push({ field, message: `'${field}' must be <= ${rule.max}` });
          break;
        }
        result[field] = value;
        continue;
      }

      case 'array':
        if (!Array.isArray(value)) {
          details.push({ field, message: `'${field}' must be an array` });
          break;
        }
        if (rule.maxLen && value.length > rule.maxLen) {
          details.push({ field, message: `'${field}' exceeds max length ${rule.maxLen}` });
          break;
        }
        if (rule.itemPattern) {
          const invalid = value.filter(
            (v) => typeof v !== 'string' || !rule.itemPattern.test(v)
          );
          if (invalid.length > 0) {
            details.push({ field, message: `'${field}' contains invalid items` });
            break;
          }
        }
        result[field] = value;
        continue;

      default:
        details.push({ field, message: `'${field}' has an unsupported validation rule` });
    }
  }

  // Reject unknown fields
  for (const key of Object.keys(body)) {
    if (!schema[key]) {
      details.push({ field: key, message: `'${key}' is not an accepted field` });
    }
  }

  if (details.length > 0) {
    throw badRequest('Request validation failed', details);
  }

  return result;
}

/** Validate that a JID looks like a WhatsApp group or user JID (defensive, not exhaustive). */
const JID_PATTERN = /^[0-9]{5,25}(@g\.us|@s\.whatsapp\.net)$/;

/** Validate a phone number (digits only, 8-15). */
const PHONE_PATTERN = /^[0-9]{8,15}$/;

/** Sanitize free text that will be stored/persisted (control chars out, length cap). */
function sanitizeText(value, maxLen = 500) {
  return String(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

module.exports = { validateBody, JID_PATTERN, PHONE_PATTERN, sanitizeText };
