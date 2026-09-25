/**
 * @file api/webpair/routes.js
 * @description Web pairing HTTP surface for headless EDBOTS deployments.
 *
 * Endpoints (all top-level, so they work on Render/Railway root-forwarded domains):
 * - GET  /pair              → the pairing page (HTML)
 * - GET  /pair/status       → JSON snapshot (token required for secret fields)
 * - GET  /pair/events       → SSE stream of auth events (token required)
 * - POST /pair/request-code → trigger Baileys pairing code (token + rate limit)
 * - POST /pair/reset        → invalidate token & re-issue (token required)
 *
 * Security:
 * - The pairing token gates everything sensitive: it is printed to the
 *   server console on boot when auth is pending, and must be pasted once
 *   in the browser (or passed as ?token=...). Visitors without it can only
 *   see a "token required" page.
 * - After token validation the browser gets an HttpOnly session cookie, so
 *   EventSource (which cannot send headers) stays authenticated.
 * - No WhatsApp credentials, session keys, or raw QR strings cross the
 *   wire — only a rendered PNG data-URL and the short-lived pairing code.
 * - Internal errors are logged server-side and returned as generic messages.
 */

const crypto = require('crypto');

const config = require('./config');
const tokenStore = require('./tokenStore');
const authEvents = require('../../core/authEvents');
const botState = require('../../core/botState');
const { sendJson } = require('../core/http');

// Invalidate the pairing token when the real CONNECTED transition arrives.
// authEvents has no change-callback API, so poll cheaply (once per second,
// only while auth is pending — see the guard below).
let tokenConsumed = false;
setInterval(() => {
    if (tokenConsumed) return;
    if (authEvents.getState() === 'CONNECTED') {
        tokenStore.consume();
        tokenConsumed = true;
    }
}, 1000).unref();

// ── Helpers ───────────────────────────────────────────────────────────────

/** Parse cookies from a request into a plain object. */
function parseCookies(req) {
    const header = req.headers.cookie || '';
    const out = {};
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx > 0) {
            out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
        }
    }
    return out;
}

/** Issue a browser session (cookie value) that lives in memory. */
const sessions = new Map(); // value → expiresAt

function issueSession(res) {
    const value = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + config.browserSessionTtlMs;
    sessions.set(value, expiresAt);
    // Opportunistic cleanup
    if (sessions.size > 500) {
        const now = Date.now();
        for (const [v, exp] of sessions) {
            if (exp < now) sessions.delete(v);
        }
    }
    res.setHeader(
        'Set-Cookie',
        `${config.browserSessionCookieName}=${value}; HttpOnly; Path=/; Max-Age=${Math.floor(config.browserSessionTtlMs / 1000)}; SameSite=Lax`
    );
    return value;
}

/** Gate that also exchanges a valid ?token= into a session cookie. */
function authorize(req, res, url) {
    const cookieValue = parseCookies(req)[config.browserSessionCookieName];
    const hasSession = cookieValue && sessions.get(cookieValue) > Date.now();
    if (hasSession) return true;

    const token = String(url.searchParams.get('token') || req.headers['x-pairing-token'] || '');
    if (tokenStore.verify(token)) {
        issueSession(res); // upgrade to cookie so EventSource works later
        return true;
    }
    return false;
}

function clientIp(req) {
    return (
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        'unknown'
    );
}

// ── HTML page ─────────────────────────────────────────────────────────────

const PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>EDBOTS — Connect WhatsApp</title>
<style>
  :root {
    --bg: #0b1220; --card: #111a2e; --border: #1e2a44; --text: #e5ecf8;
    --muted: #8b9ab5; --accent: #22c55e; --accent2: #3b82f6; --danger: #ef4444;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: linear-gradient(160deg, var(--bg) 0%, #0e1730 100%);
    color: var(--text); min-height: 100vh; display: flex;
    flex-direction: column; align-items: center; padding: 24px 16px 48px;
  }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .brand-badge {
    width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%);
    font-weight: 800; font-size: 18px; color: #04121f;
  }
  h1 { font-size: 26px; letter-spacing: 0.5px; }
  .subtitle { color: var(--muted); font-size: 14px; margin-bottom: 24px; text-align: center; }
  .card {
    width: 100%; max-width: 480px; background: var(--card);
    border: 1px solid var(--border); border-radius: 16px; padding: 24px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.35);
  }
  .tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; }
  .tab {
    padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); font-size: 14px; font-weight: 600;
    cursor: pointer; transition: all .15s ease;
  }
  .tab.active { background: rgba(59,130,246,0.12); border-color: var(--accent2); color: var(--text); }
  .panel { display: none; }
  .panel.active { display: block; }
  .label { display: block; font-size: 13px; color: var(--muted); margin: 12px 0 6px; }
  input, select {
    width: 100%; padding: 11px 12px; border-radius: 10px; border: 1px solid var(--border);
    background: #0d1526; color: var(--text); font-size: 15px; outline: none;
  }
  input:focus, select:focus { border-color: var(--accent2); }
  .btn {
    width: 100%; margin-top: 16px; padding: 12px; border-radius: 10px; border: 0;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%);
    color: #04121f; font-weight: 700; font-size: 15px; cursor: pointer;
    transition: opacity .15s ease;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn.secondary { background: transparent; border: 1px solid var(--border); color: var(--text); }
  .qr-wrap { text-align: center; }
  .qr-frame {
    display: inline-block; padding: 14px; background: #fff; border-radius: 14px;
    margin: 12px 0;
  }
  .qr-frame img { display: block; width: 260px; height: 260px; }
  .steps { text-align: left; color: var(--muted); font-size: 13.5px; line-height: 1.7; margin-top: 8px; }
  .steps b { color: var(--text); }
  .code-box {
    font-size: 34px; letter-spacing: 6px; font-weight: 800; text-align: center;
    padding: 18px 8px; margin: 14px 0; border-radius: 12px;
    background: #0d1526; border: 1px dashed var(--accent2); color: var(--accent);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .status { margin-top: 18px; padding: 12px 14px; border-radius: 10px; font-size: 14px; display: none; }
  .status.show { display: block; }
  .status.info { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.4); color: #9ec5fe; }
  .status.ok { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.4); color: #86efac; }
  .status.err { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.4); color: #fca5a5; }
  .spinner {
    width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.25);
    border-top-color: var(--accent2); border-radius: 50%;
    display: inline-block; vertical-align: -4px; margin-right: 8px;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .success-view { text-align: center; padding: 30px 0; }
  .success-view .check {
    width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 14px;
    background: rgba(34,197,94,0.15); display: grid; place-items: center;
    font-size: 30px; color: var(--accent);
  }
  .token-view { text-align: center; }
  .token-view .hint { color: var(--muted); font-size: 13.5px; line-height: 1.6; margin-top: 10px; }
  .footer { margin-top: 18px; color: var(--muted); font-size: 12px; text-align: center; }
  code { background: #0d1526; padding: 2px 6px; border-radius: 6px; font-size: 12px; }
  .hidden { display: none !important; }
</style>
</head>
<body>
  <div class="brand"><div class="brand-badge">E</div><h1>EDBOTS</h1></div>
  <div class="subtitle">Connect your WhatsApp account</div>

  <div class="card">
    <!-- Token gate -->
    <div id="token-view" class="token-view">
      <div style="font-size:28px; margin-bottom:8px;">🔒</div>
      <h2 style="font-size:18px; margin-bottom:6px;">Pairing token required</h2>
      <div class="hint">
        For security, enter the pairing token shown in your server's terminal
        (the line starting with <b>Pairing token:</b>).
      </div>
      <label class="label" for="token-input">Pairing token</label>
      <input id="token-input" type="password" autocomplete="off" placeholder="Paste token from server console">
      <button class="btn" id="token-btn">Unlock pairing page</button>
      <div id="token-error" class="status err"></div>
    </div>

    <!-- Auth UI -->
    <div id="auth-view" class="hidden">
      <div class="tabs" id="tabs">
        <button class="tab active" data-panel="panel-qr">QR Code</button>
        <button class="tab" data-panel="panel-pair">Phone Number</button>
      </div>

      <!-- QR panel -->
      <div id="panel-qr" class="panel active">
        <div class="qr-wrap">
          <div id="qr-loading" class="status info show" style="text-align:left;">
            <span class="spinner"></span>Waiting for WhatsApp QR code…
          </div>
          <div id="qr-frame" class="qr-frame hidden"><img id="qr-img" alt="WhatsApp QR code"></div>
          <div class="steps">
            <b>Open WhatsApp</b> on your phone<br>
            → <b>Settings</b> (or ⋮) → <b>Linked Devices</b><br>
            → <b>Link a Device</b> → scan this QR code
          </div>
        </div>
      </div>

      <!-- Pairing code panel -->
      <div id="panel-pair" class="panel">
        <label class="label" for="country-code">Country</label>
        <select id="country-code">
          <option value="234" selected>Nigeria (+234)</option>
          <option value="1">USA / Canada (+1)</option>
          <option value="44">United Kingdom (+44)</option>
          <option value="91">India (+91)</option>
          <option value="27">South Africa (+27)</option>
          <option value="233">Ghana (+233)</option>
          <option value="254">Kenya (+254)</option>
          <option value="212">Morocco (+212)</option>
          <option value="971">UAE (+971)</option>
          <option value="62">Indonesia (+62)</option>
          <option value="55">Brazil (+55)</option>
          <option value="49">Germany (+49)</option>
          <option value="33">France (+33)</option>
          <option value="39">Italy (+39)</option>
          <option value="34">Spain (+34)</option>
          <option value="52">Mexico (+52)</option>
          <option value="63">Philippines (+63)</option>
          <option value="92">Pakistan (+92)</option>
          <option value="880">Bangladesh (+880)</option>
          <option value="20">Egypt (+20)</option>
        </select>
        <label class="label" for="phone-input">Phone number (without country code)</label>
        <input id="phone-input" type="tel" inputmode="numeric" autocomplete="tel" placeholder="8012345678">
        <button class="btn" id="pair-btn">Get Pairing Code</button>
        <div id="code-box" class="code-box hidden"></div>
        <div id="code-expires" class="label hidden" style="text-align:center;"></div>
        <div class="steps">
          Enter the code in <b>WhatsApp → Linked Devices → Link with Phone Number</b>.
        </div>
      </div>

      <div id="status" class="status info"></div>
      <button class="btn secondary hidden" id="retry-btn">Try Again</button>
    </div>

    <!-- Success view -->
    <div id="success-view" class="success-view hidden">
      <div class="check">✓</div>
      <h2 style="font-size:18px; margin-bottom:6px;">WhatsApp connected</h2>
      <div class="subtitle" style="margin-bottom:0;">EDBOTS is ready. This page can be closed.</div>
    </div>
  </div>

  <div class="footer">
    EDBOTS Web Pairing · session data stays on your server · never share the pairing token
  </div>

<script>
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var TOKEN_KEY = 'edbots_pair_token';
  var token = sessionStorage.getItem(TOKEN_KEY) || '';
  var es = null;
  var lastState = null;
  var expiryTimer = null;

  function setStatus(kind, text) {
    var el = $('status');
    el.className = 'status show ' + (kind || 'info');
    el.textContent = text || '';
  }
  function clearStatus() { $('status').className = 'status'; $('status').textContent = ''; }

  function showView(name) {
    $('token-view').classList.toggle('hidden', name !== 'token');
    $('auth-view').classList.toggle('hidden', name !== 'auth');
    $('success-view').classList.toggle('hidden', name !== 'success');
  }

  function setRetry(onClick) {
    var btn = $('retry-btn');
    if (onClick) {
      btn.classList.remove('hidden');
      btn.onclick = onClick;
    } else {
      btn.classList.add('hidden');
      btn.onclick = null;
    }
  }

  function selectTab(name) {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-panel') === name);
    });
    document.querySelectorAll('.panel').forEach(function (p) {
      p.classList.toggle('active', p.id === name);
    });
  }
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () { selectTab(t.getAttribute('data-panel')); });
  });

  // ── SSE ────────────────────────────────────────────────────────────────
  function listen() {
    if (es) { es.close(); es = null; }
    es = new EventSource('/pair/events');
    es.onmessage = function (evt) {
      var data;
      try { data = JSON.parse(evt.data); } catch (e) { return; }
      if (data.type === 'snapshot' || data.type === 'state') applyState(data);
      if (data.type === 'qr') applyQr(data);
      if (data.type === 'pairing_code') applyPairingCode(data);
    };
    es.onerror = function () {
      // EventSource auto-reconnects; show a soft note unless already connected.
      if (lastState !== 'CONNECTED') {
        setStatus('info', 'Reconnecting to pairing server…');
      }
    };
  }

  function applyState(data) {
    lastState = data.state;
    if (expiryTimer) { clearInterval(expiryTimer); expiryTimer = null; }

    switch (data.state) {
      case 'INITIALIZING':
      case 'CONNECTING':
        showView('auth');
        selectTab('panel-qr');
        $('qr-loading').classList.add('show');
        $('qr-frame').classList.add('hidden');
        setStatus('info', 'Connecting to WhatsApp…');
        setRetry(null);
        break;
      case 'WAITING_FOR_AUTH':
        showView('auth');
        $('qr-loading').classList.add('show');
        setStatus('info', 'Choose QR Code or Phone Number to link your account.');
        setRetry(null);
        break;
      case 'QR_READY':
        showView('auth');
        if (!document.querySelector('#panel-qr img') || !$('qr-img').getAttribute('src')) {
          selectTab('panel-qr');
        }
        setStatus('info', 'QR code ready — scan it with WhatsApp.');
        setRetry(null);
        break;
      case 'PAIRING_CODE_REQUESTED':
        showView('auth');
        setStatus('info', 'Pairing code issued — enter it in WhatsApp within 2 minutes.');
        setRetry(null);
        break;
      case 'FAILED':
        showView('auth');
        setStatus('err', 'Authentication failed' + (data.reason ? ': ' + humanize(data.reason) : '.') + ' You can retry.');
        setRetry(function () { resetPairing(); });
        break;
      case 'LOGGED_OUT':
        showView('auth');
        setStatus('err', 'The WhatsApp session was logged out. Link the account again.');
        setRetry(function () { resetPairing(); });
        break;
      case 'CONNECTED':
        showView('success');
        if (es) { es.close(); es = null; }
        break;
    }
  }

  function humanize(reason) {
    return String(reason)
      .replace(/_/g, ' ')
      .replace(/^./, function (c) { return c.toUpperCase(); });
  }

  function applyQr(data) {
    if (!data.qrImage) {
      $('qr-loading').classList.add('show');
      $('qr-frame').classList.add('hidden');
      setStatus('err', 'QR code could not be rendered — a new one should arrive automatically.');
      return;
    }
    $('qr-loading').classList.remove('show');
    $('qr-frame').classList.remove('hidden');
    $('qr-img').src = data.qrImage;
  }

  function applyPairingCode(data) {
    selectTab('panel-pair');
    var box = $('code-box');
    box.classList.remove('hidden');
    box.textContent = data.code || '';
    var expEl = $('code-expires');
    expEl.classList.remove('hidden');
    var expiresAt = data.expiresAt ? new Date(data.expiresAt).getTime() : 0;
    if (expiryTimer) clearInterval(expiryTimer);
    expiryTimer = setInterval(function () {
      var left = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      if (left <= 0) {
        clearInterval(expiryTimer);
        expEl.textContent = 'Code expired — request a new one.';
        $('pair-btn').disabled = false;
      } else {
        expEl.textContent = 'Expires in ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
      }
    }, 500);
    $('pair-btn').disabled = false;
  }

  // ── Token gate ─────────────────────────────────────────────────────────
  function tryToken(value, silent) {
    return fetch('/pair/status?token=' + encodeURIComponent(value))
      .then(function (r) { return { ok: r.ok, json: r.json ? null : null, status: r.status, data: r }; })
      .then(function (res) {
        if (res.ok) {
          token = value;
          sessionStorage.setItem(TOKEN_KEY, value);
          return res.data.json();
        }
        throw new Error(res.status === 401 ? 'bad-token' : 'http-' + res.status);
      })
      .then(function (body) {
        showView('auth');
        listen();
        if (body && body.auth) applyState({ state: body.auth.state });
        return true;
      })
      .catch(function () {
        if (!silent) {
          var errEl = $('token-error');
          errEl.className = 'status err show';
          errEl.textContent = 'Invalid or expired token. Check the server console and try again.';
        }
        return false;
      });
  }

  $('token-btn').addEventListener('click', function () {
    var v = $('token-input').value.trim();
    if (!v) { $('token-error').textContent = 'Enter the token shown in the server console.'; return; }
    tryToken(v, false);
  });
  $('token-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('token-btn').click();
  });

  // ── Pairing code request ───────────────────────────────────────────────
  $('pair-btn').addEventListener('click', function () {
    var cc = $('country-code').value;
    var local = $('phone-input').value.replace(/[^0-9]/g, '');
    if (!local || local.length < 7 || local.length > 12) {
      setStatus('err', 'Enter a valid phone number (7–12 digits, without the country code).');
      return;
    }
    var full = cc + local;
    var btn = $('pair-btn');
    btn.disabled = true;
    clearStatus();
    fetch('/pair/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pairing-Token': token },
      body: JSON.stringify({ phoneNumber: full })
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, json: j }; }); })
      .then(function (res) {
        if (res.status === 202) {
          setStatus('info', 'Requesting pairing code from WhatsApp…');
          // The code arrives via SSE (pairing_code event).
        } else if (res.status === 409) {
          setStatus('info', (res.json && res.json.error && res.json.error.message) || 'A pairing code was already issued.');
          btn.disabled = false;
        } else {
          setStatus('err', (res.json && res.json.error && res.json.error.message) || 'Could not request a pairing code.');
          btn.disabled = false;
        }
      })
      .catch(function () {
        setStatus('err', 'Network error — check your connection and try again.');
        btn.disabled = false;
      });
  });

  function resetPairing() {
    fetch('/pair/reset', { method: 'POST', headers: { 'X-Pairing-Token': token } })
      .then(function () { window.location.reload(); })
      .catch(function () { window.location.reload(); });
  }

  // ── Boot ───────────────────────────────────────────────────────────────
  showView('token');
  if (token) {
    tryToken(token, true);
  }
})();
</script>
</body>
</html>`;

function sendPage(res) {
    const body = Buffer.from(PAGE_HTML, 'utf8');
    res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': body.length,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
    });
    res.end(body);
}

// ── Route handlers ────────────────────────────────────────────────────────

// Trust proxy hints only when the socket is actually remote — local health
// checks and CLI probes must not poison the learned URL.
function learnFromRequest(req) {
    try {
        const remote = req.socket && req.socket.remoteAddress;
        const host = req.headers['x-forwarded-host']?.split(',')[0]?.trim() || req.headers.host;
        if (!host) return;
        const isLocal = !remote || /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1|localhost)$/.test(remote) ||
            (config.lanIps || []).includes(remote);
        const changed = config.learnOrigin(host, isLocal);
        if (changed && !isLocal && !config.publicUrl) {
            console.log(`\x1b[36m[AUTH] Pairing URL detected from your visit: ${config.getBaseUrl()}/pair\x1b[0m`);
        }
    } catch {
        /* never break the request over URL learning */
    }
}

function handlePage(req, res, url) {
    learnFromRequest(req);
    // First visit with ?token=... : validate + set cookie before showing UI.
    if (url.searchParams.get('token')) {
        if (!authorize(req, res, url)) {
            return sendJson(res, 401, { ok: false, error: { code: 'PAIRING_TOKEN_REQUIRED', message: 'Invalid or expired pairing token.' } });
        }
    }
    sendPage(res);
}

function handleStatus(req, res, url) {
    learnFromRequest(req);
    if (!authorize(req, res, url)) {
        return sendJson(res, 401, { ok: false, error: { code: 'PAIRING_TOKEN_REQUIRED', message: 'Valid pairing token required.' } });
    }
    const snap = botState.getSnapshot();
    sendJson(res, 200, {
        ok: true,
        auth: authEvents.getSnapshot(),
        bot: { status: snap.status, online: snap.status === 'online', user: snap.user },
        publicUrl: config.getBaseUrl(),
        timestamp: new Date().toISOString()
    });
}

function handleEvents(req, res, url) {
    if (!authorize(req, res, url)) {
        return sendJson(res, 401, { ok: false, error: { code: 'PAIRING_TOKEN_REQUIRED', message: 'Valid pairing token required.' } });
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    res.write(': connected\n\n');

    const unsubscribe = authEvents.subscribe(res);

    const keepAlive = setInterval(() => {
        try { res.write(': ping\n\n'); } catch { /* closed */ }
    }, config.sseKeepAliveMs);

    req.on('close', () => {
        clearInterval(keepAlive);
        unsubscribe();
    });
}

function handleRequestCode(req, res, url, body) {
    if (!authorize(req, res, url)) {
        return sendJson(res, 401, { ok: false, error: { code: 'PAIRING_TOKEN_REQUIRED', message: 'Valid pairing token required.' } });
    }
    if (!body || typeof body !== 'object') {
        return sendJson(res, 400, { ok: false, error: { code: 'VALIDATION_ERROR', message: 'JSON body required.' } });
    }

    const raw = String(body.phoneNumber || '');
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.length < 8 || digits.length > 15) {
        return sendJson(res, 400, {
            ok: false,
            error: { code: 'INVALID_PHONE', message: 'Phone number must be 8–15 digits including country code (e.g. 2348012345678).' }
        });
    }

    if (tokenStore.tooManyAttempts(null, clientIp(req))) {
        return sendJson(res, 429, {
            ok: false,
            error: { code: 'TOO_MANY_REQUESTS', message: 'Too many pairing attempts. Try again later.' }
        });
    }

    // Ask the connection layer to request a pairing code on its NEXT qr event
    // (Baileys only accepts requestPairingCode once the socket is live and a
    // QR has been issued). The actual code arrives via the pairing_code SSE.
    const result = botState.requestWebPairing(digits);
    if (!result.ok) {
        sendJson(res, result.status, {
            ok: false,
            error: { code: result.code, message: result.message }
        });
        return;
    }

    sendJson(res, 202, {
        ok: true,
        message: 'Pairing code requested. The code will appear here in a few seconds.',
        timestamp: new Date().toISOString()
    });
}

function handleReset(req, res, url) {
    if (!authorize(req, res, url)) {
        return sendJson(res, 401, { ok: false, error: { code: 'PAIRING_TOKEN_REQUIRED', message: 'Valid pairing token required.' } });
    }
    authEvents.setState('WAITING_FOR_AUTH');
    return sendJson(res, 200, { ok: true, message: 'Pairing state reset.' });
}

// ── Entry point (called from api/server.js before /api dispatch) ─────────

/**
 * Handle a request if it belongs to the web pairing surface.
 * @returns {boolean} true when the request was fully handled here.
 */
function handle(req, res) {
    if (!config.enabled) return false;

    let url;
    try {
        url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch {
        return false;
    }

    try {
        switch (url.pathname) {
            case config.pagePath:
                handlePage(req, res, url);
                return true;

            case config.eventsPath:
                handleEvents(req, res, url);
                return true;

            case config.statusPath:
                handleStatus(req, res, url);
                return true;

            case config.pairRequestPath: {
                if (req.method !== 'POST') {
                    sendJson(res, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } });
                    return true;
                }
                // Read the JSON body before dispatching.
                let raw = '';
                let size = 0;
                let tooBig = false;
                req.on('data', (chunk) => {
                    size += chunk.length;
                    if (size > 64 * 1024) { tooBig = true; req.destroy(); return; }
                    raw += chunk;
                });
                req.on('end', () => {
                    if (tooBig) return;
                    let body = {};
                    try { body = raw ? JSON.parse(raw) : {}; } catch { /* handled below */ }
                    if (raw && typeof body !== 'object') {
                        sendJson(res, 400, { ok: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON.' } });
                        return;
                    }
                    try {
                        handleRequestCode(req, res, url, body);
                    } catch (err) {
                        console.error('[Pairing] request-code error:', err && err.message);
                        if (!res.headersSent) {
                            sendJson(res, 500, { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Pairing request failed.' } });
                        }
                    }
                });
                return true;
            }

            case config.resetPath:
                if (req.method === 'POST') {
                    handleReset(req, res, url);
                    return true;
                }
                sendJson(res, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } });
                return true;

            default:
                return false;
        }
    } catch (err) {
        // Never leak internals to the browser.
        console.error('[Pairing] Unhandled error:', err && err.stack ? err.stack : err);
        if (!res.headersSent) {
            sendJson(res, 500, { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Pairing service error.' } });
        }
        return true;
    }
}

module.exports = { handle, sendPage };
