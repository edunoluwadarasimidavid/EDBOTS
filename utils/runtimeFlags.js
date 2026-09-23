/**
 * @file runtimeFlags.js
 * @description Runtime feature flags that the REST API can change instantly
 * AND that survive a bot restart.
 *
 * Two mechanisms, chosen per flag:
 *
 * 1. AI engine gate (core/handler.js reads runtimeFlags directly):
 *    - Instant: cached flag in this module.
 *    - Persistent: src/config/manager.js -> data/config.json (ai.enabled).
 *
 * 2. Auto-reply gate (core/handler.js reads the legacy config.js module
 *    object at message time):
 *    - Instant: mutate the in-memory legacy config object the handler
 *      already holds a reference to.
 *    - Persistent: ConfigManager + syncToLegacy() rewrites config.js so the
 *      next process boot starts in the same state.
 */

const configManager = require('../src/config/manager');

const cache = { aiEnabled: null };

/**
 * Is the AI engine enabled? Defaults to true (same as before this module
 * existed — the `ai:` prefix always worked out of the box).
 */
function getAiEnabled() {
  if (cache.aiEnabled === null) {
    try {
      cache.aiEnabled = configManager.get('ai.enabled') !== false;
    } catch (err) {
      cache.aiEnabled = true;
    }
  }
  return cache.aiEnabled;
}

/**
 * Enable/disable the AI engine at runtime (instant) and persist the choice.
 */
function setAiEnabled(value) {
  cache.aiEnabled = !!value;
  try {
    configManager.set('ai.enabled', !!value);
    return true;
  } catch (err) {
    console.error('[RuntimeFlags] Persist error:', err.message);
    return false;
  }
}

/**
 * Live auto-reply flag (legacy config.js object). Read fresh every time —
 * the API mutates this same object.
 */
function getAutoReplyEnabled() {
  try {
    // eslint-disable-next-line global-require
    const legacyConfig = require('../config');
    return legacyConfig.autoReply === true;
  } catch {
    return false;
  }
}

/**
 * Toggle global auto-reply: instant on the running handler + persisted to
 * config.js for future boots. Mirrors what `edbots customize` does.
 */
function setAutoReplyEnabled(value) {
  const next = !!value;

  // 1. Instant: the running handler holds this exact object
  try {
    // eslint-disable-next-line global-require
    const legacyConfig = require('../config');
    legacyConfig.autoReply = next;
  } catch (err) {
    console.error('[RuntimeFlags] Legacy config mutation failed:', err.message);
  }

  // 2. Persistent: data/config.json + config.js rewrite
  try {
    configManager.set('behavior.autoReply', next);
    configManager.syncToLegacy();
  } catch (err) {
    console.error('[RuntimeFlags] AutoReply persist error:', err.message);
  }

  return true;
}

module.exports = { getAiEnabled, setAiEnabled, getAutoReplyEnabled, setAutoReplyEnabled };
