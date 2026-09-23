/**
 * @file api/routes/commands.js
 * @description Command management: list, enable/disable globally, and view
 * per-group disabled commands.
 *
 * Global toggles use utils/commandToggles (enforced in core/handler.js).
 * Per-group toggles use the existing database.js disableCmd/enableCmd.
 */

const { loadCommands } = require('../../utils/commandLoader');
const commandToggles = require('../../utils/commandToggles');
const database = require('../../database');
const { sendJson } = require('../core/http');
const { requireScope } = require('../core/router');
const { validateBody, JID_PATTERN } = require('../core/validate');
const { badRequest, notFound } = require('../core/errors');

let commandsCache = null;

function getCommands() {
  if (!commandsCache) {
    commandsCache = loadCommands();
  }
  return commandsCache;
}

// Collapse aliases: keep the canonical name, remember aliases
function buildCommandList() {
  const commands = getCommands();
  const byCanonical = new Map();

  for (const [key, cmd] of commands.entries()) {
    if (key === cmd.name.toLowerCase()) {
      byCanonical.set(key, {
        name: cmd.name,
        description: cmd.description || '',
        category: cmd.category || 'general',
        aliases: Array.isArray(cmd.aliases) ? cmd.aliases : [],
        ownerOnly: cmd.ownerOnly === true,
        adminOnly: cmd.adminOnly === true,
        groupOnly: cmd.groupOnly === true,
        visibility: cmd.visibility || 'public'
      });
    }
  }
  return [...byCanonical.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function findCommand(name) {
  const lower = String(name).trim().toLowerCase();
  const list = buildCommandList();
  const direct = list.find((c) => c.name.toLowerCase() === lower);
  if (direct) return direct;
  return list.find((c) => c.aliases.some((a) => a.toLowerCase() === lower)) || null;
}

function register(router) {
  router.get('/commands', requireScope('read'), async (req, res) => {
    const disabled = new Set(commandToggles.listDisabled());
    const commands = buildCommandList().map((c) => ({
      ...c,
      enabled: !disabled.has(c.name.toLowerCase())
    }));
    sendJson(res, 200, { ok: true, count: commands.length, commands });
  });

  router.post('/commands/:name/enable', requireScope('write'), async (req, res) => {
    const cmd = findCommand(req.params.name);
    if (!cmd) throw notFound(`Unknown command '${req.params.name}'`);

    const changed = commandToggles.enable(cmd.name);
    sendJson(res, 200, {
      ok: true,
      command: cmd.name,
      enabled: true,
      changed
    });
  });

  router.post('/commands/:name/disable', requireScope('write'), async (req, res) => {
    const cmd = findCommand(req.params.name);
    if (!cmd) throw notFound(`Unknown command '${req.params.name}'`);

    const changed = commandToggles.disable(cmd.name);
    sendJson(res, 200, {
      ok: true,
      command: cmd.name,
      enabled: false,
      changed
    });
  });

  // Per-group command state
  router.get('/commands/group/:groupId', requireScope('read'), async (req, res) => {
    const { groupId } = req.params;
    if (!JID_PATTERN.test(groupId)) throw badRequest('groupId must be a WhatsApp group JID like 123456789@g.us');

    const list = readGroupDisabled(groupId);
    const commands = buildCommandList().map((c) => ({
      name: c.name,
      enabled: !list.includes(c.name.toLowerCase())
    }));
    sendJson(res, 200, { ok: true, groupId, commands });
  });

  router.post('/commands/group/:groupId/enable', requireScope('write'), async (req, res) => {
    const { groupId } = req.params;
    const body = validateBody(req.body, { command: { type: 'string', maxLen: 50, required: true } });

    const cmd = findCommand(body.command);
 if (!cmd) throw notFound(`Unknown command '${body.command}'`);

    database.enableCmd(groupId, cmd.name.toLowerCase());
    sendJson(res, 200, { ok: true, groupId, command: cmd.name, enabled: true });
  });

  router.post('/commands/group/:groupId/disable', requireScope('write'), async (req, res) => {
    const { groupId } = req.params;
    const body = validateBody(req.body, { command: { type: 'string', maxLen: 50, required: true } });

    const cmd = findCommand(body.command);
    if (!cmd) throw notFound(`Unknown command '${body.command}'`);

    database.disableCmd(groupId, cmd.name.toLowerCase());
    sendJson(res, 200, { ok: true, groupId, command: cmd.name, enabled: false });
  });
}

// Read the per-group disabled list straight from the store used by database.js
function readGroupDisabled(groupId) {
  const fs = require('fs');
  const path = require('path');
  const file = path.join(__dirname, '..', '..', 'database', 'disabledCommands.json');
  try {
    if (!fs.existsSync(file)) return [];
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data[groupId]) ? data[groupId] : [];
  } catch {
    return [];
  }
}

module.exports = { register };
