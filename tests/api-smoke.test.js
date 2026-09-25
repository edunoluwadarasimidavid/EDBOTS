/**
 * temp/api-smoke.js — self-terminating smoke test for the EDBOTS REST API.
 * Boots the API in-process on a test port, exercises endpoints, restores
 * state, and exits. Never calls /bot/start (no WhatsApp connection attempt).
 */
process.env.EDBOTS_API_PORT = '3777';
process.env.EDBOTS_API_KEY = 'smoke-test-key-123';
process.env.EDBOTS_API_CORS_ORIGINS = 'https://app.example.com';
// Web pairing test config: fixed token file so we can restore it after.
process.env.PORT = '3777';

const assert = require('assert');
const http = require('http');

const BASE = 'http://127.0.0.1:3777';
const KEY = 'smoke-test-key-123';

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
          try { json = JSON.parse(out); } catch { /* keep raw */ }
          resolve({ status: res.statusCode, headers: res.headers, json, raw: out });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const auth = { 'X-API-Key': KEY };

// ── Web pairing helpers ─────────────────────────────────────────────
const tokenFile = require('path').join(__dirname, '..', 'data', 'pairingToken.json');
let pairingTokenBackup = null;

/** Generate a fresh pairing token for tests (returns plaintext). */
function mintPairingToken() {
  const tokenStore = require('../api/webpair/tokenStore');
  return tokenStore.create();
}

/** Read an SSE stream until `count` data frames arrive or timeout. */
function readSseFrames(path, headers, count, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const frames = [];
    const req = http.request(`${BASE}${path}`, { headers }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buf += chunk;
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const line = raw.split('\n').find((l) => l.startsWith('data: '));
          if (line) {
            try { frames.push(JSON.parse(line.slice(6))); } catch { /* skip */ }
          }
          if (frames.length >= count) {
            req.destroy();
            resolve(frames);
            return;
          }
        }
      });
      res.on('end', () => resolve(frames));
      res.on('error', () => resolve(frames));
    });
    req.on('error', () => resolve(frames));
    req.end();
    setTimeout(() => { req.destroy(); resolve(frames); }, timeoutMs);
  });
}

let snapshotConfig = null;
let togglesBefore = null;

async function main() {
  const { start } = require('../api/server');
  const server = start();

  await new Promise((r) => setTimeout(r, 300));

  const results = [];
  const check = (name, cond) => {
    results.push({ name, pass: !!cond });
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  };

  // 0. Backup state we might mutate
  const fs = require('fs');
  const cfgPath = require('path').join(__dirname, '..', 'data', 'config.json');
  const togPath = require('path').join(__dirname, '..', 'data', 'commandToggles.json');
  snapshotConfig = fs.existsSync(cfgPath) ? fs.readFileSync(cfgPath, 'utf8') : null;
  togglesBefore = fs.existsSync(togPath) ? fs.readFileSync(togPath, 'utf8') : null;
  pairingTokenBackup = fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8') : null;

  try {
    // 1. Health (public)
    const h = await request('GET', '/api/health');
    check('health 200 no-auth', h.status === 200 && h.json.ok === true);
    check('health has botVersion', typeof h.json.botVersion === 'string');

    // 2. Root index
    const idx = await request('GET', '/api');
    check('api index lists endpoints', idx.status === 200 && Array.isArray(idx.json.endpoints));

    // 3. Auth enforcement
    const noAuth = await request('GET', '/api/status');
    check('missing key -> 401', noAuth.status === 401 && noAuth.json.error.code === 'UNAUTHORIZED');

    const badKey = await request('GET', '/api/status', null, { 'X-API-Key': 'wrong-key' });
    check('bad key -> 401', badKey.status === 401);

    // 4. Status (authed)
    const st = await request('GET', '/api/status', null, auth);
    check('status 200 with bot object', st.status === 200 && typeof st.json.bot.online === 'boolean');
    check('status has no credentials', !JSON.stringify(st.json).toLowerCase().includes('creds'));

    // 5. Settings read + write + restore
    const s1 = await request('GET', '/api/settings', null, auth);
    check('settings GET', s1.status === 200 && typeof s1.json.settings.autoReply === 'boolean');

    const targetAutoReply = !s1.json.settings.autoReply;
    const s2 = await request('PATCH', '/api/settings', { autoReply: targetAutoReply }, auth);
    check('settings PATCH 200', s2.status === 200 && s2.json.settings.autoReply === targetAutoReply);
    if (s2.status !== 200) console.log('  settings PATCH response:', s2.status, s2.raw);

    const s3 = await request('PATCH', '/api/settings', { autoReply: s1.json.settings.autoReply }, auth);
    check('settings restored', s3.status === 200 && s3.json.settings.autoReply === s1.json.settings.autoReply);

    // 6. Validation errors
    const v1 = await request('PATCH', '/api/settings', { botName: 42 }, auth);
    check('bad type -> 400 with details', v1.status === 400 && Array.isArray(v1.json.error.details));

    const v2 = await request('PATCH', '/api/settings', { notAField: true }, auth);
    check('unknown field -> 400', v2.status === 400);

    // 7. Commands list + toggle + restore
    const c1 = await request('GET', '/api/commands', null, auth);
    check('commands list', c1.status === 200 && c1.json.count > 0);

    const someCmd = c1.json.commands.find((c) => !c.ownerOnly) || c1.json.commands[0];
    const c2 = await request('POST', `/api/commands/${someCmd.name}/disable`, {}, auth);
    check('command disable', c2.status === 200 && c2.json.enabled === false);

    const c3 = await request('POST', `/api/commands/${someCmd.name}/enable`, {}, auth);
    check('command enable', c3.status === 200 && c3.json.enabled === true);

    const c4 = await request('POST', '/api/commands/definitely_not_a_cmd/disable', {}, auth);
    check('unknown command -> 404', c4.status === 404);

    // 8. Autoreply
    const a1 = await request('GET', '/api/autoreply', null, auth);
    check('autoreply GET', a1.status === 200 && typeof a1.json.globalEnabled === 'boolean');

    const a2 = await request('PATCH', '/api/autoreply/chat/smoke-test@s.whatsapp.net', { enabled: true }, auth);
    check('autoreply per-chat PATCH', a2.status === 200 && a2.json.config && a2.json.config.enabled === true);
    if (a2.status !== 200) console.log('  autoreply PATCH response:', a2.status, a2.raw);

    const a3 = await request('POST', '/api/autoreply/chat/smoke-test@s.whatsapp.net/keywords',
      { keyword: 'SMOKE_TEST_KW', response: 'test-response', caseSensitive: false }, auth);
    check('keyword add 201', a3.status === 201);

    const a4 = await request('DELETE', '/api/autoreply/chat/smoke-test@s.whatsapp.net/keywords/SMOKE_TEST_KW', null, auth);
    check('keyword delete', a4.status === 200 && a4.json.removed === true);

    // Clean the test chat entry
    try { fs.unlinkSync(require('path').join(__dirname, '..', 'data', 'smartAutoReply.json')); } catch { /* may not exist */ }

    // 9. AI settings
    const ai1 = await request('GET', '/api/ai', null, auth);
    check('ai GET', ai1.status === 200 && typeof ai1.json.ai.enabled === 'boolean');

    const ai2 = await request('PATCH', '/api/ai', { personality: 'professional' }, auth);
    check('ai PATCH personality', ai2.status === 200 && ai2.json.ai.personality === 'professional');

    const ai3 = await request('PATCH', '/api/ai', { personality: 'nonsense' }, auth);
    check('ai bad enum -> 400', ai3.status === 400);

    const ai4 = await request('PATCH', '/api/ai', { personality: ai1.json.ai.personality }, auth);
    check('ai personality restored', ai4.status === 200);

    // 10. Groups validation (no live socket needed)
    const g1 = await request('GET', '/api/groups', null, auth);
    check('groups GET works offline', g1.status === 200 && g1.json.groups.length === 0);

    const g2 = await request('GET', '/api/groups/not-a-jid/settings', null, auth);
    check('bad JID -> 400', g2.status === 400);

    const g3 = await request('GET', '/api/groups/123456789@g.us/settings', null, auth);
    check('group settings read', g3.status === 200 && typeof g3.json.settings === 'object');

    const g4 = await request('PATCH', '/api/groups/123456789@g.us/settings', { antilink: true }, auth);
    check('group settings PATCH', g4.status === 200 && g4.json.settings.antilink === true);

    // 11. Stats
    const stats = await request('GET', '/api/stats', null, auth);
    check('stats 200 with system info', stats.status === 200 && typeof stats.json.system.memoryRssMb === 'number');

    // 12. CORS
    const cors = await request('OPTIONS', '/api/status', null, {
      Origin: 'https://app.example.com',
      'Access-Control-Request-Method': 'PATCH'
    });
    check('CORS preflight 204', cors.status === 204);
    check('CORS origin echoed', cors.headers['access-control-allow-origin'] === 'https://app.example.com');

    const corsDenied = await request('GET', '/api/health', null, { Origin: 'https://evil.example.com' });
    check('CORS disallowed origin has no ACAO', corsDenied.headers['access-control-allow-origin'] === undefined);

    // 13. 404/405
    const nf = await request('GET', '/api/nonexistent', null, auth);
    check('unknown route -> 404', nf.status === 404);

    const mna = await request('DELETE', '/api/settings', null, auth);
    check('wrong method -> 405', mna.status === 405);

    // 14. Rate limit (default 120/window; hammer 130 quick requests)
    let limited = false;
    for (let i = 0; i < 130; i++) {
      const r = await request('GET', '/api/status', null, { 'X-API-Key': 'rate-limit-probe' });
      if (r.status === 200 || r.status === 401) continue; // 401 = auth failed before rate check
      if (r.status === 429) { limited = true; break; }
    }
    check('rate limiting kicks in', limited);

    // ══ Web pairing ═══════════════════════════════════════════════════
    // NOTE: these checks run against the same server (webpair is mounted
    // BEFORE /api dispatch). The pairing token is minted for the test.
    const wpToken = mintPairingToken();
    check('pairing token minted', typeof wpToken === 'string' && wpToken.length >= 32);

    // Page is public HTML
    const page = await request('GET', '/pair');
    check('pair page 200 HTML', page.status === 200 && /EDBOTS/.test(page.raw) && /Pairing token required/.test(page.raw));

    // Sensitive endpoints are gated without a token
    const stNoTok = await request('GET', '/pair/status');
    check('pair/status no-token 401', stNoTok.status === 401);

    const rcNoTok = await request('POST', '/pair/request-code', { phoneNumber: '2348012345678' });
    check('pair/request-code no-token 401', rcNoTok.status === 401);

    const evNoTok = await request('GET', '/pair/events');
    check('pair/events no-token 401', evNoTok.status === 401);

    // With token: status exposes only safe fields
    const stTok = await request('GET', `/pair/status?token=${wpToken}`);
    const stTokStr = stTok.raw || '';
    check('pair/status token 200', stTok.status === 200 && stTok.json.ok === true);
    check('pair/status has state', typeof stTok.json.auth.state === 'string');
    check('pair/status no creds', !/creds|session-|privatekey|prekey/i.test(stTokStr));

    // SSE: first frame is a snapshot with a state
    const frames = await readSseFrames(`/pair/events?token=${wpToken}`, null, 1);
    check('pair/events snapshot frame', frames.length >= 1 && frames[0].type === 'snapshot' && typeof frames[0].state === 'string');

    // request-code validation: bad number -> 400
    const rcBad = await request('POST', '/pair/request-code', { phoneNumber: '123' }, { 'X-Pairing-Token': wpToken });
    check('pair/request-code bad number 400', rcBad.status === 400 && rcBad.json.error.code === 'INVALID_PHONE');

    // request-code with valid number while no socket -> 503 SOCKET_NOT_READY (no WhatsApp here)
    const rcOk = await request('POST', '/pair/request-code', { phoneNumber: '2348012345678' }, { 'X-Pairing-Token': wpToken });
    check('pair/request-code no-socket 503', rcOk.status === 503 && rcOk.json.error.code === 'SOCKET_NOT_READY');

    // reset endpoint
    const rs = await request('POST', '/pair/reset', {}, { 'X-Pairing-Token': wpToken });
    check('pair/reset 200', rs.status === 200 && rs.json.ok === true);

    // 404 on unknown pairing path (falls through to /api 404 handling)
    const wp404 = await request('GET', '/pair/nope');
    check('pair unknown path 404', wp404.status === 404);
  } finally {
    server.close();

    // Restore mutated state
    if (pairingTokenBackup !== null) fs.writeFileSync(tokenFile, pairingTokenBackup);
    else if (fs.existsSync(tokenFile)) fs.unlinkSync(tokenFile);

    if (snapshotConfig !== null) fs.writeFileSync(cfgPath, snapshotConfig);
    else if (fs.existsSync(cfgPath)) fs.unlinkSync(cfgPath);

    if (togglesBefore !== null) fs.writeFileSync(togPath, togglesBefore);
    else if (fs.existsSync(togPath)) fs.unlinkSync(togPath);

    const failed = results.filter((r) => !r.pass);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    process.exit(failed.length === 0 ? 0 : 1);
  }
}

main().catch((err) => {
  console.error('SMOKE TEST ERROR:', err);
  process.exit(1);
});
