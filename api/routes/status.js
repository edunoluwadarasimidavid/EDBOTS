/**
 * @file api/routes/status.js
 * @description GET /api/status — bot online/offline status and session identity.
 * Requires authentication. Users only see non-secret runtime state.
 */

const botState = require('../../core/botState');
const { sendJson } = require('../core/http');
const { requireScope } = require('../core/router');

function register(router) {
  router.get('/status', requireScope('read'), async (req, res) => {
    const snap = botState.getSnapshot();

    sendJson(res, 200, {
      ok: true,
      bot: {
        online: snap.status === 'online',
        status: snap.status, // offline | connecting | online
        user: snap.user, // { id, name } or null — never credentials
        startedAt: snap.startedAt,
        lastConnectedAt: snap.lastConnectedAt,
        lastDisconnectedAt: snap.lastDisconnectedAt,
        lastDisconnectReason: snap.lastDisconnectReason
      },
      timestamp: new Date().toISOString()
    });
  });
}

module.exports = { register };
