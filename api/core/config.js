/**
 * @file api/core/config.js
 * @description API layer configuration, sourced from environment variables.
 * No secrets are ever hardcoded here.
 */

const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

const apiConfig = {
  // Base path for every endpoint (e.g. http://localhost:3000/api/health)
  basePath: '/api',

  // Port: respects Freebuff/host PORT, overridable with EDBOTS_API_PORT
  port: parseInt(process.env.EDBOTS_API_PORT || process.env.PORT || '3000', 10),

  // Host binding: 0.0.0.0 so containers/platforms can reach it
  host: process.env.EDBOTS_API_HOST || '0.0.0.0',

  // Master key: full-access key. If unset, only keys stored in
  // data/apiKeys.json (created via api/createKey.js) work. Fail-closed.
  masterKey: process.env.EDBOTS_API_KEY || '',

  // CORS for the future EDBOTS App (browser/PWA clients).
  // Comma-separated origins, or "*" for any origin. Mobile apps are unaffected.
  corsOrigins: (process.env.EDBOTS_API_CORS_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Rate limiting (requests per window per key/IP)
  rateLimitWindowMs: parseInt(process.env.EDBOTS_API_RATE_WINDOW_MS || '60000', 10),
  rateLimitMax: parseInt(process.env.EDBOTS_API_RATE_LIMIT || '120', 10),

  // Max JSON body size (bytes)
  maxBodyBytes: parseInt(process.env.EDBOTS_API_MAX_BODY || String(1024 * 1024), 10),

  // API can be turned off entirely without touching code
  enabled: process.env.EDBOTS_API_ENABLED !== 'false',

  // Where per-user API keys live (gitignored, contains only SHA-256 hashes)
  keysFile: path.join(ROOT_DIR, 'data', 'apiKeys.json'),

  // App metadata reported by /api/health
  name: 'EDBOTS API',
  version: '1.0.0'
};

module.exports = apiConfig;
