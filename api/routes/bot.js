/**
 * @file api/routes/bot.js
 * @description Bot lifecycle control: POST /api/bot/start, POST /api/bot/stop.
 *
 * Stop semantics: marks the runtime as stopped via core/botState and closes
 * the socket; connection.js deliberately skips reconnection when flagged.
 * Start semantics: clears the flag and reconnects inside the SAME process so
 * session files are never touched and no credentials are exposed.
 */

const botState = require('../../core/botState');
const { sendJson } = require('../core/http');
const { requireScope } = require('../core/router');
const { serviceUnavailable } = require('../core/errors');

function register(router) {
  router.post('/bot/stop', requireScope('write'), async (req, res) => {
    const before = botState.getSnapshot().status;
    botState.requestStop();
    sendJson(res, 200, {
      ok: true,
      action: 'stop',
      previousStatus: before,
      status: botState.getSnapshot().status,
      message: 'Bot stopped. The WhatsApp session was preserved.'
    });
  });

  router.post('/bot/start', requireScope('write'), async (req, res) => {
    const snap = botState.getSnapshot();

    if (snap.status === 'online') {
      return sendJson(res, 200, {
        ok: true,
        action: 'start',
        status: 'online',
        message: 'Bot is already online.'
      });
    }

    botState.requestStart();

    try {
      // Reconnect within this process using the existing engine.
      // eslint-disable-next-line global-require
      const { connectToWhatsApp } = require('../../core/connection');
      connectToWhatsApp().catch((err) => {
        console.error('[API] Reconnect failed:', err.message);
      });

      // Give the socket a moment so the response reflects reality.
      await new Promise((r) => setTimeout(r, 1500));

      sendJson(res, 202, {
        ok: true,
        action: 'start',
        status: botState.getSnapshot().status,
        message: 'Start requested. Poll GET /api/status for the connection result.'
      });
    } catch (err) {
      throw serviceUnavailable(`Failed to start bot: ${err.message}`);
    }
  });
}

module.exports = { register };
