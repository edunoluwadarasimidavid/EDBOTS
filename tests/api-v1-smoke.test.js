/**
 * tests/api-v1-smoke.test.js — Phase 2 + Part A + Part B smoke suite for the
 * /api/v1 namespace. Boots the API in-process on a private test port. Never
 * touches a real WhatsApp session: bot "online" states are simulated with a
 * fake socket, and Appwrite is mocked in-process (configurable free/premium
 * plus an outage switch for the fail-closed test).
 */
process.env.EDBOTS_API_PORT = '3779';
process.env.PORT = '3779';
process.env.EDBOTS_API_KEY = 'v1-smoke-key-123';
process.env.EDBOTS_API_CORS_ORIGINS = 'https://app.example.com';

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:3779';
const KEY = 'v1-smoke-key-123';
const auth = { 'X-API-Key': KEY };

// ── Mock Appwrite (in-process) ──────────────────────────────────────────────
// Maps Bearer JWTs to a fixed free user; premiumUsers flips membership;
// outage makes every Appwrite call throw (fail-closed 503 test).
const mockState = { premiumUsers: false, outage: false };
function b64(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
const JWT_FREE = `x.${b64({ exp: Math.floor(Date.now() / 1000) + 600, sub: 'jwt-user-1' })}.y`;
const freeAuth = { Authorization: `Bearer ${JWT_FREE}` };

function installMockAppwrite() {
  const https = require('https');
  const realRequest = https.request;
  https.request = function mocked(uriOrOptions, ...rest) {
    const target = typeof uriOrOptions === 'string' ? uriOrOptions : (uriOrOptions && uriOrOptions.hostname) || '';
    if (String(target).includes('appwrite')) {
      if (mockState.outage) throw new Error('network blocked in test');
      // appwriteClient passes a URL object (use .pathname); a string or
      // options object may also arrive (use .path / raw string).
      const urlPath =
        typeof uriOrOptions === 'string'
          ? uriOrOptions
          : String((uriOrOptions && (uriOrOptions.pathname || uriOrOptions.path)) || '');
      const isAccount = urlPath.includes('/account');
      const resLike = {
        statusCode: 200,
        setEncoding() {},
        on(evt, cb) {
          if (evt === 'data') {
            cb(JSON.stringify(
              isAccount
                ? { $id: 'jwt-user-1', name: 'JWT Tester', email: 'jwt@test.local' }
                : { documents: mockState.premiumUsers ? [{ $id: 'row1', user_id: 'jwt-user-1' }] : [] }
            ));
          }
          if (evt === 'end') cb();
        }
      };
      const cb = rest[rest.length - 1];
      if (typeof cb === 'function') cb(resLike);
      return { on() {}, end() {}, destroy() {} };
    }
    return realRequest.call(https, uriOrOptions, ...rest);
  };
}

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      `${BASE}${path}`,
      {
        method,
        headers: {
          ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
          ...headers
        }
      },
      (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(out); } catch { /* raw */ }
          resolve({ status: res.statusCode, headers: res.headers, json, raw: out });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

let snapshotConfig = null;
let togglesBefore = null;

async function main() {
  installMockAppwrite();

  const { start } = require('../api/server');
  const server = start();
  await new Promise((r) => setTimeout(r, 300));

  const results = [];
  const check = (name, cond, extra) => {
    results.push({ name, pass: !!cond });
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond || !extra ? '' : ` — ${extra}`}`);
  };

  const cfgPath = path.join(__dirname, '..', 'data', 'config.json');
  const togPath = path.join(__dirname, '..', 'data', 'commandToggles.json');
  snapshotConfig = fs.existsSync(cfgPath) ? fs.readFileSync(cfgPath, 'utf8') : null;
  togglesBefore = fs.existsSync(togPath) ? fs.readFileSync(togPath, 'utf8') : null;

  try {
    // ── 1. Envelope + public health ────────────────────────────────────
    const h = await request('GET', '/api/v1/health');
    check('v1 health public 200', h.status === 200 && h.json.success === true && h.json.error === null);
    check('v1 health data has botVersion', typeof h.json.data.botVersion === 'string');

    // ── 2. Auth enforcement ────────────────────────────────────────────
    const noAuth = await request('GET', '/api/v1/status');
    check('missing creds -> 401 UNAUTHORIZED', noAuth.status === 401 && noAuth.json.success === false
      && noAuth.json.data === null && noAuth.json.error.code === 'UNAUTHORIZED');

    const badKey = await request('GET', '/api/v1/status', null, { 'X-API-Key': 'wrong' });
    check('bad api key -> 401', badKey.status === 401 && badKey.json.error.code === 'UNAUTHORIZED');

    // Locally expired JWT must be rejected without any Appwrite call.
    const expiredJwt = `x.${b64({ exp: 1 })}.y`;
    const expRes = await request('GET', '/api/v1/status', null, { Authorization: `Bearer ${expiredJwt}` });
    check('expired JWT -> 401 (no network)', expRes.status === 401 && expRes.json.error.code === 'UNAUTHORIZED');

    // Well-formed JWT + Appwrite outage -> 503 (fail closed).
    mockState.outage = true;
    const uwRes = await request('GET', '/api/v1/status', null, freeAuth);
    mockState.outage = false;
    check('JWT + Appwrite unreachable -> 503', uwRes.status === 503, `got ${uwRes.status} ${uwRes.raw.slice(0, 120)}`);

    // ── 3. Legacy API-key still works on v1 ───────────────────────────
    const st = await request('GET', '/api/v1/status', null, auth);
    check('v1 status with api key', st.status === 200 && st.json.success === true
      && typeof st.json.data.bot.online === 'boolean');
    check('v1 status no legacy ok field', st.json.data.ok === undefined);

    // ── 4. Delegated write route + validation mapping ─────────────────
    const s1 = await request('GET', '/api/v1/settings', null, auth);
    check('v1 settings GET', s1.status === 200 && typeof s1.json.data.settings.autoReply === 'boolean');

    const v1bad = await request('PATCH', '/api/v1/settings', { notAField: true }, auth);
    check('v1 unknown field -> 400 VALIDATION_ERROR', v1bad.status === 400
      && v1bad.json.error.code === 'VALIDATION_ERROR' && Array.isArray(v1bad.json.error.details));

    const v1badType = await request('PATCH', '/api/v1/settings', { autoReply: 'yes' }, auth);
    check('v1 bad type -> 400', v1badType.status === 400 && v1badType.json.error.code === 'VALIDATION_ERROR');

    // ── 5. Commands delegation ────────────────────────────────────────
    const c1 = await request('GET', '/api/v1/commands', null, auth);
    check('v1 commands list', c1.status === 200 && c1.json.data.count > 0);

    const someCmd = c1.json.data.commands.find((c) => !c.ownerOnly) || c1.json.data.commands[0];
    const c2 = await request('POST', `/api/v1/commands/${someCmd.name}/disable`, {}, auth);
    check('v1 command disable', c2.status === 200 && c2.json.data.enabled === false);
    const c3 = await request('POST', `/api/v1/commands/${someCmd.name}/enable`, {}, auth);
    check('v1 command enable', c3.status === 200 && c3.json.data.enabled === true);

    // Param delegation with :name materialization
    const c4 = await request('POST', '/api/v1/commands/definitely_not_a_cmd/disable', {}, auth);
    check('v1 unknown command -> 404 NOT_FOUND', c4.status === 404 && c4.json.error.code === 'NOT_FOUND');

    // ── 6. Bot lifecycle (no WhatsApp) ────────────────────────────────
    // Restart while offline & never API-stopped: deterministic no-op that
    // must NOT boot a WhatsApp connection.
    const br = await request('POST', '/api/v1/bot/restart', {}, auth);
    check('v1 bot restart (idle) -> 200 no-op', br.status === 200 && br.json.success === true
      && br.json.data.action === 'restart' && /bot\/start/.test(br.json.data.message),
      `got ${br.status} ${br.raw.slice(0, 120)}`);
    await new Promise((r) => setTimeout(r, 300));
    const bst0 = await request('GET', '/api/v1/status', null, auth);
    check('v1 idle restart did not connect', bst0.json.data.bot.status === 'offline');

    const bs = await request('POST', '/api/v1/bot/stop', {}, auth);
    check('v1 bot stop (self-hosted key bypasses ad gate)', bs.status === 200 && bs.json.data.action === 'stop');
    const bst = await request('GET', '/api/v1/status', null, auth);
    check('v1 status reflects stopped', bst.json.data.bot.status === 'offline');

    // ── 7. Pairing surface ────────────────────────────────────────────
    const qr1 = await request('GET', '/api/v1/pair/qr', null, auth);
    check('v1 pair/qr -> 404 when no QR', qr1.status === 404 && qr1.json.error.code === 'NOT_FOUND');

    const ph1 = await request('POST', '/api/v1/pair/phone', { phoneNumber: '123' }, auth);
    check('v1 pair/phone bad number 400', ph1.status === 400 && ph1.json.error.code === 'VALIDATION_ERROR');

    const ph2 = await request('POST', '/api/v1/pair/phone', { phoneNumber: '2348012345678' }, auth);
    // No socket in test env -> BOT_NOT_CONNECTED (mapped from SOCKET_NOT_READY).
    check('v1 pair/phone no-socket -> 503 BOT_NOT_CONNECTED', ph2.status === 503
      && ph2.json.error.code === 'BOT_NOT_CONNECTED', `got ${ph2.status}`);

    const ph3 = await request('POST', '/api/v1/pair/phone', { phoneNumber: '2348012345678' }, auth);
    check('v1 pair/phone cooldown NOT burned by failure', ph3.status === 503,
      'cooldown must only engage after a queued request');

    const ps = await request('GET', '/api/v1/pair/status', null, auth);
    check('v1 pair/status', ps.status === 200 && typeof ps.json.data.auth.state === 'string');

    const pr = await request('POST', '/api/v1/pair/reset', {}, auth);
    check('v1 pair/reset', pr.status === 200 && pr.json.success === true);

    // ── 8. 404 shape ──────────────────────────────────────────────────
    const nf = await request('GET', '/api/v1/nonexistent', null, auth);
    check('v1 unknown route -> 404 envelope', nf.status === 404 && nf.json.success === false
      && nf.json.error.code === 'NOT_FOUND');

    // ── 9. LevelPlay ad gate (PART A) ─────────────────────────────────
    const CB_TOKEN = 'test-callback-token-0123456789abcdef';
    process.env.LEVELPLAY_CALLBACK_TOKEN = CB_TOKEN;

    const cbBad = await request('GET', '/api/v1/ads/callback/wrong-token?userId=u1&eventId=e1');
    check('ad callback bad token -> 404', cbBad.status === 404 && cbBad.json.error.code === 'NOT_FOUND');

    const ad1 = await request('POST', '/api/v1/ads/session', { action: 'start_bot' }, auth);
    check('ads/session 200 with pendingKey', ad1.status === 200 && ad1.json.success === true
      && typeof ad1.json.data.pendingKey === 'string' && ad1.json.data.pendingKey.endsWith('|start_bot'));

    const st0 = await request('GET', '/api/v1/ads/status?action=start_bot', null, auth);
    check('ads/status pending unverified', st0.status === 200 && st0.json.data.pending === true
      && st0.json.data.verified === false);

    const cb1 = await request('GET', `/api/v1/ads/callback/${CB_TOKEN}?userId=system&eventId=EV-100&rewards=1`);
    check('ad callback acks [eventId]:OK', cb1.status === 200 && cb1.raw === '[EV-100]:OK');

    const st1 = await request('GET', '/api/v1/ads/status?action=start_bot', null, auth);
    check('ads/status now verified', st1.status === 200 && st1.json.data.verified === true);

    const cb2 = await request('GET', `/api/v1/ads/callback/${CB_TOKEN}?userId=system&eventId=EV-100&rewards=1`);
    check('ad callback eventId dedup -> OK', cb2.status === 200 && cb2.raw === '[EV-100]:OK');

    const cb3 = await request('GET', `/api/v1/ads/callback/${CB_TOKEN}?userId=nobody&eventId=EV-404&rewards=1`);
    check('ad callback unmatched session still acks', cb3.status === 200 && cb3.raw === '[EV-404]:OK');

    const adNoAuth = await request('POST', '/api/v1/ads/session', { action: 'start_bot' });
    check('ads/session requires auth', adNoAuth.status === 401 && adNoAuth.json.error.code === 'UNAUTHORIZED');
    const adBadAction = await request('POST', '/api/v1/ads/session', { action: 'free_money' }, auth);
    check('ads/session bad action -> 400', adBadAction.status === 400
      && adBadAction.json.error.code === 'VALIDATION_ERROR');

    // ── 10. Part B: ad-or-premium gating on bot start/stop ────────────
    const botState = require('../core/botState');
    const authModule = require('../api/v1/auth');

    // Premium bypass #1: self-hosted key passes with NO ad session.
    const pb0 = await request('POST', '/api/v1/bot/stop', {}, auth);
    check('self-hosted key bypasses ad gate (stop_bot)', pb0.status === 200 && pb0.json.data.action === 'stop');

    // Free JWT user, no verified session -> 403 AD_REQUIRED.
    const pb1 = await request('POST', '/api/v1/bot/start', {}, freeAuth);
    check('start_bot blocked with AD_REQUIRED (free, no session)', pb1.status === 403
      && pb1.json.error.code === 'AD_REQUIRED' && /rewarded ad/i.test(pb1.json.error.message),
      `got ${pb1.status} ${pb1.raw.slice(0, 120)}`);

    const pb1b = await request('POST', '/api/v1/bot/stop', {}, freeAuth);
    check('stop_bot blocked with AD_REQUIRED (free, no session)', pb1b.status === 403
      && pb1b.json.error.code === 'AD_REQUIRED');

    // A session for a DIFFERENT action must not unlock start_bot (entries
    // are keyed per action; only a verified start_bot entry unlocks start).
    // NOTE: no S2S callback is fired here — the callback verifies the most
    // recent unverified session and carries no action param.
    const pb2a = await request('POST', '/api/v1/ads/session', { action: 'stop_bot' }, freeAuth);
    check('ads/session for free user (stop_bot)', pb2a.status === 200
      && pb2a.json.data.pendingKey === 'jwt-user-1|stop_bot');
    const pb2b = await request('POST', '/api/v1/bot/start', {}, freeAuth);
    check('wrong-action session does not unlock start_bot', pb2b.status === 403
      && pb2b.json.error.code === 'AD_REQUIRED');

    // Create the start_bot session and verify it through the S2S callback.
    const pb2 = await request('POST', '/api/v1/ads/session', { action: 'start_bot' }, freeAuth);
    check('ads/session for free user (start_bot)', pb2.status === 200
      && pb2.json.data.pendingKey === 'jwt-user-1|start_bot');
    const pb3 = await request('GET', `/api/v1/ads/callback/${CB_TOKEN}?userId=jwt-user-1&eventId=PB-EV-1&rewards=1`);
    check('S2S callback acks [PB-EV-1]:OK', pb3.status === 200 && pb3.raw === '[PB-EV-1]:OK');
    const pb3s = await request('GET', '/api/v1/ads/status?action=start_bot', null, freeAuth);
    check('ads/status verified for free user', pb3s.status === 200 && pb3s.json.data.verified === true);

    // Simulate "online" with a fake socket so /bot/start takes the
    // idempotent already-online branch (never boots Baileys in tests).
    botState.setStatus('online');
    botState.setSocket({ user: { id: 'test:1', name: 'TestBot' }, end: () => {} });

    const pb4 = await request('POST', '/api/v1/bot/start', {}, freeAuth);
    check('start_bot succeeds after verified ad (free user)', pb4.status === 200
      && pb4.json.success === true && pb4.json.data.action === 'start',
      `got ${pb4.status} ${pb4.raw.slice(0, 120)}`);

    const pb5 = await request('POST', '/api/v1/bot/start', {}, freeAuth);
    check('verified session is single-use (second start_bot -> AD_REQUIRED)', pb5.status === 403
      && pb5.json.error.code === 'AD_REQUIRED');

    // stop_bot same pattern: blocked -> session -> callback -> allowed.
    const pb6 = await request('POST', '/api/v1/bot/stop', {}, freeAuth);
    check('stop_bot blocked until its own ad is verified', pb6.status === 403
      && pb6.json.error.code === 'AD_REQUIRED');
    await request('POST', '/api/v1/ads/session', { action: 'stop_bot' }, freeAuth);
    await request('GET', `/api/v1/ads/callback/${CB_TOKEN}?userId=jwt-user-1&eventId=PB-EV-2&rewards=1`);
    const pb7 = await request('POST', '/api/v1/bot/stop', {}, freeAuth);
    check('stop_bot succeeds after verified ad (free user)', pb7.status === 200
      && pb7.json.data.action === 'stop', `got ${pb7.status} ${pb7.raw.slice(0, 120)}`);
    const pb8 = await request('POST', '/api/v1/bot/stop', {}, freeAuth);
    check('stop_bot verified session also single-use', pb8.status === 403
      && pb8.json.error.code === 'AD_REQUIRED');

    // Premium bypass #2: Appwrite-premium JWT needs no ad at all.
    mockState.premiumUsers = true;
    authModule._premiumCache.clear(); // drop cached "free" membership
    botState.setStatus('online');
    botState.setSocket({ user: { id: 'test:1', name: 'TestBot' }, end: () => {} });
    const pb9 = await request('POST', '/api/v1/bot/start', {}, freeAuth);
    check('premium JWT bypasses ad requirement entirely', pb9.status === 200
      && pb9.json.data.action === 'start', `got ${pb9.status} ${pb9.raw.slice(0, 120)}`);

    // restore mock defaults for any future sections
    mockState.premiumUsers = false;
    authModule._premiumCache.clear();

    // ── 11. Part C: daily message quota ──────────────────────────────
    const messageQuota = require('../api/v1/messageQuota');
    messageQuota._resetMessageQuota();

    // The handler integration must load cleanly with the quota wired in.
    const handlerModule = require('../core/handler');
    check('core/handler loads with quota integration', typeof handlerModule.handleMessage === 'function');

    // Operator identity is last-writer-wins: the latest v1 request before
    // this section was the PREMIUM bypass check, so re-register the free
    // identity with a real request (exactly what the app does on login).
    await request('GET', '/api/v1/status', null, freeAuth);
    const op = messageQuota.getActiveOperator();
    check('operator registered from v1 auth layer', !!op && op.userId === 'jwt-user-1'
      && op.isPremium === false && op.isAppwrite === true);

    // Free user usage starts at 0/100.
    const u0 = await request('GET', '/api/v1/usage', null, freeAuth);
    check('usage endpoint for free user', u0.status === 200 && u0.json.success === true
      && u0.json.data.used === 0 && u0.json.data.ceiling === 100 && u0.json.data.isPremium === false
      && typeof u0.json.data.resetsAt === 'string');

    // Counter increments on message processing (same admitMessage call the
    // handler makes): 99 admissions bring the counter to the edge.
    let last;
    for (let i = 0; i < 99; i++) last = messageQuota.admitMessage({});
    check('counter increments per message (99/100)', last.allowed === true && last.used === 99
      && last.ceiling === 100);

    // LIMIT_EXCEEDED fires exactly at the ceiling for a free user.
    const atLimit = messageQuota.admitMessage({});
    check('message #100 (at ceiling) allowed', atLimit.allowed === true && atLimit.used === 100);
    const over = messageQuota.admitMessage({});
    check('message #101 blocked at ceiling', over.allowed === false && over.used === 100
      && over.ceiling === 100 && over.shouldNotify === true);
    const over2 = messageQuota.admitMessage({});
    check('blocked messages never consume quota; notify once/day', over2.allowed === false
      && over2.used === 100 && over2.shouldNotify === false);

    // raise_limit ad-watch adds +50 via the real /ads/session flow.
    const rl1 = await request('POST', '/api/v1/ads/session', { action: 'raise_limit' }, freeAuth);
    check('raise_limit pending session (no boost yet)', rl1.status === 200
      && rl1.json.data.pendingKey === 'jwt-user-1|raise_limit' && rl1.json.data.boostApplied === undefined);
    await request('GET', `/api/v1/ads/callback/${CB_TOKEN}?userId=jwt-user-1&eventId=PC-EV-1&rewards=1`);
    const rl2 = await request('POST', '/api/v1/ads/session', { action: 'raise_limit' }, freeAuth);
    check('verified raise_limit consumed -> +50 boost', rl2.status === 200
      && rl2.json.data.boostApplied === true && rl2.json.data.newCeiling === 150,
      JSON.stringify(rl2.json));

    const boosted = messageQuota.admitMessage({});
    check('boosted ceiling admits message #101', boosted.allowed === true && boosted.used === 101
      && boosted.ceiling === 150);

    // Boosts stack within the same UTC day: second ad → 200.
    await request('POST', '/api/v1/ads/session', { action: 'raise_limit' }, freeAuth);
    await request('GET', `/api/v1/ads/callback/${CB_TOKEN}?userId=jwt-user-1&eventId=PC-EV-2&rewards=1`);
    const rl3 = await request('POST', '/api/v1/ads/session', { action: 'raise_limit' }, freeAuth);
    check('second ad stacks ceiling to 200', rl3.json.data.boostApplied === true
      && rl3.json.data.newCeiling === 200);

    const u1 = await request('GET', '/api/v1/usage', null, freeAuth);
    check('usage reflects boost (101 used / 200 ceiling)', u1.json.data.used === 101
      && u1.json.data.ceiling === 200);

    // New UTC day: lazy reset restores 0 used and base ceiling 100.
    messageQuota._forceDate('jwt-user-1', '2000-01-01');
    const u2 = await request('GET', '/api/v1/usage', null, freeAuth);
    check('new UTC day resets to 0/100', u2.json.data.used === 0 && u2.json.data.ceiling === 100);

    // Premium never capped regardless of count.
    mockState.premiumUsers = true;
    authModule._premiumCache.clear();
    messageQuota.setActiveOperator({ userId: 'jwt-user-1', isPremium: true, isAppwrite: true });
    let premiumLast;
    for (let i = 0; i < 250; i++) premiumLast = messageQuota.admitMessage({});
    check('premium: 250 admissions all allowed', premiumLast.allowed === true && premiumLast.used === 250);
    const up = await request('GET', '/api/v1/usage', null, freeAuth);
    check('premium usage view: ceiling null, isPremium true', up.json.data.used === 250
      && up.json.data.ceiling === null && up.json.data.isPremium === true);
    mockState.premiumUsers = false;
    authModule._premiumCache.clear();
    messageQuota._resetMessageQuota();

    // ── 12. Legacy namespace untouched ────────────────────────────────
    const oldStatus = await request('GET', '/api/status', null, auth);
    check('legacy /api/status unchanged shape', oldStatus.status === 200 && oldStatus.json.ok === true
      && oldStatus.json.success === undefined);
    const oldV1RouteOnLegacy = await request('GET', '/api/restart', null, auth);
    check('legacy has no /api/restart (unchanged)', oldV1RouteOnLegacy.status === 404);
  } finally {
    server.close();

    if (snapshotConfig !== null) fs.writeFileSync(cfgPath, snapshotConfig);
    else if (fs.existsSync(cfgPath)) fs.unlinkSync(cfgPath);
    if (togglesBefore !== null) fs.writeFileSync(togPath, togglesBefore);
    else if (fs.existsSync(togPath)) fs.unlinkSync(togPath);

    const failed = results.filter((r) => !r.pass);
    console.log(`\n${results.length - failed.length}/${results.length} v1 checks passed`);
    process.exit(failed.length === 0 ? 0 : 1);
  }
}

main().catch((err) => {
  console.error('V1 SMOKE ERROR:', err);
  process.exit(1);
});
