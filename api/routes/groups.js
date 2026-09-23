/**
 * @file api/routes/groups.js
 * @description Group-management settings: list groups the bot is in and
 * read/update per-group moderation settings via the existing database.js
 * (the exact store core/handler.js and group commands use).
 */

const botState = require('../../core/botState');
const database = require('../../database');
const { sendJson } = require('../core/http');
const { requireScope } = require('../core/router');
const { validateBody, JID_PATTERN } = require('../core/validate');
const { badRequest, serviceUnavailable } = require('../core/errors');

// Allowed action values per config.js defaults
const ACTION_FIELDS = ['antilinkAction', 'antitagAction', 'antigroupmentionAction'];

const GROUP_BOOL_FIELDS = [
  'antilink', 'antitag', 'antiall', 'antiviewonce', 'antibot', 'anticall',
  'antigroupmention', 'welcome', 'goodbye', 'antiSpam', 'antidelete',
  'nsfw', 'detect', 'chatbot', 'autosticker'
];

const BOOL = { type: 'boolean' };

function register(router) {
  router.get('/groups', requireScope('read'), async (req, res) => {
    const sock = botState.getSocket ? botState.getSocket() : null;
    const online = (botState.getSnapshot().status === 'online') && !!sock;

    if (!online) {
      return sendJson(res, 200, {
        ok: true,
        online: false,
        note: 'Bot is offline; connect first to list groups.',
        groups: []
      });
    }

    try {
      const metadata = await sock.groupFetchAllParticipating();
      const groups = Object.values(metadata || {}).map((g) => ({
        id: g.id,
        name: g.subject || '',
        size: (g.participants || []).length,
        isBotAdmin: (g.participants || []).some(
          (p) => p.id && p.id.startsWith((sock.user && sock.user.id || '').split(':')[0]) && p.admin
        )
      }));
      sendJson(res, 200, { ok: true, online: true, count: groups.length, groups });
    } catch (err) {
      throw serviceUnavailable(`Failed to list groups: ${err.message}`);
    }
  });

  router.get('/groups/:groupId/settings', requireScope('read'), async (req, res) => {
    const { groupId } = req.params;
    if (!JID_PATTERN.test(groupId)) {
      throw badRequest('groupId must be a WhatsApp group JID like 123456789@g.us');
    }
    sendJson(res, 200, { ok: true, groupId, settings: database.getGroupSettings(groupId) });
  });

  router.patch('/groups/:groupId/settings', requireScope('write'), async (req, res) => {
    const { groupId } = req.params;
    if (!JID_PATTERN.test(groupId)) {
      throw badRequest('groupId must be a WhatsApp group JID like 123456789@g.us');
    }

    const schema = {};
    for (const f of GROUP_BOOL_FIELDS) schema[f] = BOOL;
    for (const f of ACTION_FIELDS) {
      schema[f] = { type: 'string', enum: ['delete', 'kick', 'warn'] };
    }

    const body = validateBody(req.body, schema);

    // Apply only provided fields; updateGroupSettings merges safely
    const patch = {};
    for (const f of [...GROUP_BOOL_FIELDS, ...ACTION_FIELDS]) {
      if (body[f] !== undefined) patch[f] = body[f];
    }
    if (Object.keys(patch).length === 0) {
      throw badRequest('No known group setting fields provided');
    }

    const updated = database.updateGroupSettings(groupId, patch);
    if (!updated) throw serviceUnavailable('Failed to persist group settings');

    sendJson(res, 200, { ok: true, groupId, settings: database.getGroupSettings(groupId) });
  });
}

module.exports = { register };
