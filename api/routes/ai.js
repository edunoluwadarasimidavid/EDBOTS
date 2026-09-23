/**
 * @file api/routes/ai.js
 * @description AI settings routes.
 *
 * - GET/PATCH /api/ai            — enable/disable the AI engine (instant + persistent)
 * - GET/PATCH /api/ai/personality— AI personality for chat modes
 *
 * Uses utils/runtimeFlags (instant effect in the running handler) backed by
 * the existing ConfigManager (persistent across restarts). Provider API keys
 * are NEVER exposed here.
 */

const runtimeFlags = require('../../utils/runtimeFlags');
const configManager = require('../../src/config/manager');
const { sendJson } = require('../core/http');
const { requireScope } = require('../core/router');
const { validateBody, sanitizeText } = require('../core/validate');

const PERSONALITIES = ['friendly', 'professional', 'funny', 'concise', 'custom'];

function register(router) {
  router.get('/ai', requireScope('read'), async (req, res) => {
    sendJson(res, 200, {
      ok: true,
      ai: {
        enabled: runtimeFlags.getAiEnabled(),
        personality: configManager.get('ai.personality') || 'friendly'
      }
    });
  });

  router.patch('/ai', requireScope('write'), async (req, res) => {
    const body = validateBody(
      req.body,
      { enabled: { type: 'boolean' }, personality: { type: 'string', enum: PERSONALITIES } }
    );

    if (body.enabled !== undefined) {
      runtimeFlags.setAiEnabled(body.enabled);
    }
    if (body.personality !== undefined) {
      configManager.set('ai.personality', sanitizeText(body.personality, 30));
    }

    sendJson(res, 200, {
      ok: true,
      ai: {
        enabled: runtimeFlags.getAiEnabled(),
        personality: configManager.get('ai.personality') || 'friendly'
      }
    });
  });
}

module.exports = { register };
