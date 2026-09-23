/**
 * @file api/routes/stats.js
 * @description GET /api/stats — basic bot statistics.
 *
 * Aggregates counts from the existing JSON stores (database/ and data/)
 * without exposing any message content, credentials, or identifiers.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const botState = require('../../core/botState');
const { getFormattedUptime } = require('../../utils/uptime');
const { sendJson } = require('../core/http');
const { requireScope } = require('../core/router');
const { serviceUnavailable } = require('../core/errors');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function countKeys(obj) {
  return obj && typeof obj === 'object' ? Object.keys(obj).length : 0;
}

function register(router) {
  router.get('/stats', requireScope('read'), async (req, res) => {
    try {
      const snap = botState.getSnapshot();

      const groupsDb = readJsonSafe(path.join(ROOT_DIR, 'database', 'groups.json'), {});
      const usersDb = readJsonSafe(path.join(ROOT_DIR, 'database', 'users.json'), {});
      const bannedDb = readJsonSafe(path.join(ROOT_DIR, 'database', 'banned.json'), { banned: [] });
      const groupStats = readJsonSafe(path.join(ROOT_DIR, 'database', 'groupStats.json'), {});
      const toggles = readJsonSafe(path.join(ROOT_DIR, 'data', 'commandToggles.json'), { disabled: [] });
      const autoReplyData = readJsonSafe(path.join(ROOT_DIR, 'data', 'smartAutoReply.json'), {});

      // Sum all-time group messages from the daily stats store
      let totalGroupMessages = 0;
      let activeGroupsToday = 0;
      const today = new Date().toISOString().slice(0, 10);
      for (const [, days] of Object.entries(groupStats)) {
        for (const [day, dayStats] of Object.entries(days || {})) {
          totalGroupMessages += (dayStats && dayStats.total) || 0;
          if (day === today) activeGroupsToday += 1;
        }
      }

      const mem = process.memoryUsage();

      sendJson(res, 200, {
        ok: true,
        bot: {
          status: snap.status,
          online: snap.status === 'online',
          uptimeHuman: getFormattedUptime(),
          uptimeSec: Math.floor(process.uptime()),
          startedAt: snap.startedAt,
          lastConnectedAt: snap.lastConnectedAt
        },
        commands: {
          disabledGlobally: Array.isArray(toggles.disabled) ? toggles.disabled.length : 0
        },
        groups: {
          known: countKeys(groupsDb),
          activeToday: activeGroupsToday,
          totalMessagesTracked: totalGroupMessages
        },
        users: {
          known: countKeys(usersDb),
          banned: Array.isArray(bannedDb.banned) ? bannedDb.banned.length : 0
        },
        autoReply: {
          chats: countKeys(autoReplyData)
        },
        system: {
          node: process.version,
          platform: `${os.type()} ${os.arch()}`,
          memoryRssMb: Math.round(mem.rss / 1024 / 1024),
          loadAvg1m: os.loadavg()[0]
        },
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      throw serviceUnavailable(`Failed to compute stats: ${err.message}`);
    }
  });
}

module.exports = { register };
