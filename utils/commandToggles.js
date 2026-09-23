/**
 * @file commandToggles.js
 * @description Global command enable/disable registry, persisted to JSON.
 *
 * Shared by:
 * - core/handler.js (enforces the disable at message-handling time)
 * - api/routes/commands.js (REST control surface)
 *
 * This is intentionally additive: commands default to enabled and the bot
 * behaves exactly as before when this file/store is untouched.
 */

const fs = require('fs');
const path = require('path');

const TOGGLES_FILE = path.join(__dirname, '..', 'data', 'commandToggles.json');

const cache = { data: null };

function ensureDir() {
  const dir = path.dirname(TOGGLES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load() {
  if (cache.data) return cache.data;
  try {
    if (fs.existsSync(TOGGLES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TOGGLES_FILE, 'utf8'));
      cache.data = {
        disabled: Array.isArray(parsed.disabled) ? parsed.disabled : [],
        updatedAt: parsed.updatedAt || null
      };
    } else {
      cache.data = { disabled: [], updatedAt: null };
    }
  } catch (err) {
    console.error('[CommandToggles] Load error:', err.message);
    cache.data = { disabled: [], updatedAt: null };
  }
  return cache.data;
}

function save() {
  try {
    ensureDir();
    cache.data.updatedAt = new Date().toISOString();
    const tmp = TOGGLES_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cache.data, null, 2));
    fs.renameSync(tmp, TOGGLES_FILE);
    return true;
  } catch (err) {
    console.error('[CommandToggles] Save error:', err.message);
    return false;
  }
}

const normalize = (name) => String(name || '').trim().toLowerCase();

/**
 * Is a command globally disabled?
 * Owner bypass is decided by the caller (handler passes context.isOwner).
 */
function isDisabled(commandName) {
  const name = normalize(commandName);
  if (!name) return false;
  return load().disabled.includes(name);
}

function disable(commandName) {
  const name = normalize(commandName);
  const data = load();
  if (!data.disabled.includes(name)) {
    data.disabled.push(name);
    save();
    return true;
  }
  return false; // already disabled
}

function enable(commandName) {
  const name = normalize(commandName);
  const data = load();
  const before = data.disabled.length;
  data.disabled = data.disabled.filter((c) => c !== name);
  if (data.disabled.length !== before) {
    save();
    return true;
  }
  return false; // was not disabled
}

function listDisabled() {
  return [...load().disabled];
}

module.exports = { isDisabled, disable, enable, listDisabled };
