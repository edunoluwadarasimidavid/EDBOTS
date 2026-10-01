/**
 * @file api/v1/messageQuota.js
 * @description Per-user daily message quota with ad-based temporary boosts
 * (Part C). Pure data module — no HTTP, no Express-style imports, so
 * core/handler.js can require it without dependency cycles.
 *
 * Model:
 * - One counter per operator userId: { userId, date (UTC day string),
 *   count, ceiling }. Base ceiling = 100.
 * - Lazy reset: when the stored date no longer matches today's UTC date,
 *   the counter resets on next read. No cron needed.
 * - Premium users are tracked but NEVER capped.
 * - Each verified "raise_limit" rewarded ad adds +50 to that user's ceiling
 *   for the rest of the current UTC day (stacks: 100 → 150 → 200 …).
 *
 * Operator binding (design note, see Part C report): the WhatsApp handler
 * has no HTTP context, so the v1 auth layer registers the authenticated
 * operator identity (userId + premium) via setActiveOperator() on every v1
 * request (last-writer-wins — the product is single-session/single-owner).
 * Until an operator is registered (pure self-hosted, app never connected),
 * the quota is INACTIVE and nothing is capped.
 */

const BASE_CEILING = parseInt(process.env.EDBOTS_DAILY_MSG_QUOTA || '100', 10);
const BOOST_PER_AD = parseInt(process.env.EDBOTS_AD_MSG_BOOST || '50', 10);

// userId → { date, count, ceiling, notifiedOn }
const counters = new Map();

// Active operator identity, registered by the v1 auth layer.
let activeOperator = null; // { userId, isPremium, isAppwrite }

function todayUTC(now = new Date()) {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Next UTC midnight as an ISO timestamp. */
function nextUtcMidnight(now = new Date()) {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString();
}

/** Get today's counter for a user, lazily resetting on a new UTC day. */
function ensureCounter(userId, now = new Date()) {
  const today = todayUTC(now);
  let c = counters.get(userId);
  if (!c || c.date !== today) {
    c = { date: today, count: 0, ceiling: BASE_CEILING, notifiedOn: null };
    counters.set(userId, c);
  }
  return c;
}

// ── Operator registration (called by api/v1/auth.js) ───────────────────────

function setActiveOperator({ userId, isPremium, isAppwrite }) {
  activeOperator = { userId: String(userId), isPremium: !!isPremium, isAppwrite: !!isAppwrite };
}

function getActiveOperator() {
  return activeOperator;
}

// ── Core quota operations ──────────────────────────────────────────────────

/**
 * Count one message for `userId`. Premium users are tracked but never
 * capped.
 * @returns {{allowed:boolean, used:number, ceiling:number, isPremium:boolean}}
 */
function checkAndIncrement(userId, isPremium, now = new Date()) {
  const c = ensureCounter(userId, now);
  c.count += 1; // premium usage is counted for /usage, just never capped
  const allowed = isPremium || c.count <= c.ceiling;
  return { allowed, used: c.count, ceiling: isPremium ? null : c.ceiling, isPremium: !!isPremium };
}

/**
 * Admission check performed by core/handler.js before processing a message.
 * - No registered operator → quota inactive, always allowed.
 * - Bot's own outgoing echoes (fromMe) are never counted.
 * - Denied messages do NOT consume quota (the count only advances on
 *   allowed messages).
 * @returns {{allowed:boolean, userId?:string, used?:number, ceiling?:number,
 *            shouldNotify?:boolean, inactive?:boolean}}
 */
function admitMessage({ fromMe = false } = {}, now = new Date()) {
  if (!activeOperator) return { allowed: true, inactive: true };
  if (fromMe) return { allowed: true };

  const { userId, isPremium } = activeOperator;
  const c = ensureCounter(userId, now);

  if (isPremium) {
    c.count += 1;
    return { allowed: true, userId, used: c.count, ceiling: null };
  }

  if (c.count + 1 > c.ceiling) {
    // One friendly notice per UTC day per user; drops themselves never count.
    const today = todayUTC(now);
    const shouldNotify = c.notifiedOn !== today;
    c.notifiedOn = today;
    return { allowed: false, userId, used: c.count, ceiling: c.ceiling, shouldNotify };
  }

  c.count += 1;
  return { allowed: true, userId, used: c.count, ceiling: c.ceiling };
}

/**
 * Apply a verified raise_limit reward: +50 ceiling for the rest of the
 * current UTC day. Stacks with previous same-day boosts. Returns the new
 * effective ceiling for the (non-premium) user.
 */
function applyRaiseLimit(userId, now = new Date()) {
  const c = ensureCounter(userId, now);
  c.ceiling += BOOST_PER_AD;
  return { ceiling: c.ceiling, boost: BOOST_PER_AD, date: c.date };
}

/** Usage view for GET /api/v1/usage. */
function getUsage(userId, isPremium, now = new Date()) {
  const c = ensureCounter(userId, now);
  return {
    used: c.count,
    ceiling: isPremium ? null : c.ceiling,
    isPremium: !!isPremium,
    resetsAt: nextUtcMidnight(now)
  };
}

// ── Test hooks ─────────────────────────────────────────────────────────────
function _resetMessageQuota() {
  counters.clear();
  activeOperator = null;
}
function _forceDate(userId, dateStr) {
  const c = ensureCounter(userId);
  c.date = dateStr; // next read lazily resets
}
function _setCount(userId, n, now = new Date()) {
  const c = ensureCounter(userId, now);
  c.count = n;
}

module.exports = {
  BASE_CEILING,
  BOOST_PER_AD,
  todayUTC,
  nextUtcMidnight,
  setActiveOperator,
  getActiveOperator,
  checkAndIncrement,
  admitMessage,
  applyRaiseLimit,
  getUsage,
  _resetMessageQuota,
  _forceDate,
  _setCount
};
