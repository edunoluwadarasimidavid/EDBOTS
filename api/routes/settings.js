/**
 * @file api/routes/settings.js
 * @description Bot behavior settings: GET /api/settings, PATCH /api/settings.
 *
 * Writes go to data/config.json via the existing ConfigManager (same store
 * the CLI `edbots customize` wizard uses), then sync the legacy config.js
 * flags the running bot actually reads. Behavior changes are instant via
 * utils/runtimeFlags for the flags the handler consults at message-time.
 */

const configManager = require('../../src/config/manager');
const runtimeFlags = require('../../utils/runtimeFlags');
const { sendJson } = require('../core/http');
const { requireScope } = require('../core/router');
const { validateBody } = require('../core/validate');
const { serviceUnavailable } = require('../core/errors');

const BOOLEAN_FLAGS = [
  'selfMode',
  'autoRead',
  'autoTyping',
  'autoBio',
  'autoSticker',
  'autoReact',
  'autoDownload',
  'autoReply'
];

const BOOL = { type: 'boolean' };
const STR = { type: 'string' };

function register(router) {
  router.get('/settings', requireScope('read'), async (req, res) => {
    sendJson(res, 200, { ok: true, settings: buildSettingsView() });
  });

  router.patch('/settings', requireScope('write'), async (req, res) => {
    const body = validateBody(
      req.body,
      {
        botName: { ...STR, maxLen: 50 },
        description: { type: 'string', maxLen: 200 },
        prefix: { type: 'string', maxLen: 3 },
        timezone: { type: 'string', maxLen: 50 },
        selfMode: BOOL,
        autoRead: BOOL,
        autoTyping: BOOL,
        autoBio: BOOL,
        autoSticker: BOOL,
        autoReact: BOOL,
        autoDownload: BOOL,
        autoReply: BOOL
      },
      req.body
    );

    try {
      // 1. Identity fields → ConfigManager (persists to data/config.json)
      if (body.botName !== undefined) configManager.set('bot.displayName', body.botName);
      if (body.description !== undefined) configManager.set('bot.description', body.description);
      if (body.prefix !== undefined) configManager.set('bot.prefix', body.prefix);
      if (body.timezone !== undefined) configManager.set('bot.timezone', body.timezone);

      // 2. Behavior flags → ConfigManager + runtimeFlags (instant, persistent)
      for (const flag of BOOLEAN_FLAGS) {
        if (body[flag] !== undefined) {
          configManager.set(`behavior.${flag}`, body[flag]);
          if (flag === 'autoReply') runtimeFlags.setAutoReplyEnabled(body[flag]);
        }
      }

      // 3. Sync legacy config.js the running bot reads
      const synced = configManager.syncToLegacy();
      if (!synced) {
        throw serviceUnavailable('Settings saved but legacy sync failed; try again.');
      }

      sendJson(res, 200, { ok: true, settings: buildSettingsView() });
    } catch (err) {
      if (err && err.name === 'ApiError') throw err;
      throw serviceUnavailable(`Failed to update settings: ${err.message}`);
    }
  });
}

function buildSettingsView() {
  return {
    botName: configManager.get('bot.displayName'),
    description: configManager.get('bot.description'),
    prefix: configManager.get('bot.prefix'),
    timezone: configManager.get('bot.timezone'),
    selfMode: configManager.get('behavior.selfMode') === true,
    autoRead: configManager.get('behavior.autoRead') === true,
    autoTyping: configManager.get('behavior.autoTyping') === true,
    autoBio: configManager.get('behavior.autoBio') === true,
    autoSticker: configManager.get('behavior.autoSticker') === true,
    autoReact: configManager.get('behavior.autoReact') === true,
    autoDownload: configManager.get('behavior.autoDownload') === true,
    autoReply: configManager.get('behavior.autoReply') === true
  };
}

module.exports = { register };
