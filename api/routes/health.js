/**
 * @file api/routes/health.js
 * @description GET /api/health — public liveness probe. No auth required.
 */

const os = require('os');
const config = require('../core/config');
const { sendJson } = require('../core/http');

function register(router) {
  router.get('/health', async (req, res) => {
    sendJson(res, 200, {
      ok: true,
      service: config.name,
      version: config.version,
      botVersion: (() => {
        try {
          // eslint-disable-next-line global-require
          return require('../../bot_version.json').version || null;
        } catch {
          return null;
        }
      })(),
      uptimeSec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      host: {
        node: process.version,
        platform: `${os.type()} ${os.arch()}`
      }
    });
  });
}

module.exports = { register };
