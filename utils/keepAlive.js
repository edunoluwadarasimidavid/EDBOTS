/**
 * @file keepAlive.js
 * @description Owner-controlled self-ping that keeps free-tier hosting
 * platforms (Render, Railway, Glitch, Replit, Koyeb…) from putting the
 * service to sleep. Every 10 minutes it makes a real HTTP request to this
 * process's own REST API `/api/health` endpoint — genuine inbound traffic
 * on the platform's port, no external service or dependency required.
 *
 * The ON/OFF choice persists in data/keepAlive.json (gitignored) and is
 * restored automatically every time the bot (re)connects to WhatsApp.
 *
 * URL resolution order:
 *   1. KEEP_ALIVE_URL env (explicit owner override)
 *   2. Platform public URL (same detection the web pairing UI uses:
 *      config.js webPairing.publicUrl, RENDER_EXTERNAL_URL, RAILWAY_…)
 *   3. Loopback 127.0.0.1:PORT — the bot and the REST API share one
 *      process, so loopback traffic still counts as real requests.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'data', 'keepAlive.json');
const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const PING_TIMEOUT_MS = 15000;

class KeepAlive {
    constructor() {
        this.enabled = false;
        this.timer = null;
        this.target = null;      // resolved URL (logged once per start)
        this.lastPing = null;    // ISO timestamp of last attempt
        this.lastStatus = null;  // "HTTP 200" or an error message
        this.pingsSent = 0;
    }

    // ── Persistence ────────────────────────────────────────────────
    load() {
        try {
            const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            this.enabled = !!raw.enabled;
        } catch {
            this.enabled = false;
        }
    }

    save() {
        try {
            fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
            fs.writeFileSync(STATE_FILE, JSON.stringify({
                enabled: this.enabled,
                updatedAt: new Date().toISOString()
            }, null, 2));
        } catch (e) {
            console.error('[KEEP-ALIVE] Save error:', e.message);
        }
    }

    // ── Target URL resolution ──────────────────────────────────────
    resolveTarget() {
        const port = parseInt(process.env.PORT || '3000', 10);

        // 1. Explicit override
        const explicit = (process.env.KEEP_ALIVE_URL || '').trim();
        if (explicit) {
            return explicit.replace(/\/+$/, '') + '/api/health';
        }

        // 2. Platform public URL (shared detection with web pairing)
        try {
            const { detectPublicUrl } = require('../api/webpair/publicUrl');
            const cfgUrl = (require('../config').webPairing || {}).publicUrl || null;
            const detected = detectPublicUrl(cfgUrl, port);
            if (detected.url) return `${detected.url}/api/health`;
        } catch {
            /* fall through to loopback */
        }

        // 3. Loopback — same process hosts both bot and REST API
        return `http://127.0.0.1:${port}/api/health`;
    }

    // ── Ping ───────────────────────────────────────────────────────
    pingOnce() {
        if (!this.enabled) return;
        if (!this.target) this.target = this.resolveTarget();

        try {
            const client = this.target.startsWith('https') ? https : http;
            const req = client.get(this.target, { timeout: PING_TIMEOUT_MS }, (res) => {
                res.resume(); // drain the body
                this.lastPing = new Date().toISOString();
                this.lastStatus = `HTTP ${res.statusCode}`;
                this.pingsSent++;
            });
            req.on('timeout', () => req.destroy(new Error('ping timeout')));
            req.on('error', (e) => {
                this.lastPing = new Date().toISOString();
                this.lastStatus = e.message;
            });
        } catch (e) {
            this.lastPing = new Date().toISOString();
            this.lastStatus = e.message;
        }
    }

    // ── Control ────────────────────────────────────────────────────
    start(silent = false) {
        if (this.timer) return; // already running
        this.enabled = true;
        this.save();
        this.target = this.resolveTarget();
        this.pingOnce(); // immediate first ping
        this.timer = setInterval(() => this.pingOnce(), INTERVAL_MS);
        if (this.timer.unref) this.timer.unref(); // never hold the process open
        if (!silent) {
            console.log(`\x1b[32m[KEEP-ALIVE] ✅ Started — pinging ${this.target} every 10 minutes\x1b[0m`);
        }
    }

    stop(silent = false) {
        this.enabled = false;
        this.save();
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (!silent) {
            console.log('\x1b[33m[KEEP-ALIVE] 💤 Stopped — the host may sleep after inactivity\x1b[0m');
        }
    }

    /** Restore the persisted preference. Called when the bot comes online. */
    restore() {
        this.load();
        if (this.enabled) this.start(true);
    }

    status() {
        return {
            enabled: this.enabled,
            target: this.target || this.resolveTarget(),
            intervalMinutes: Math.round(INTERVAL_MS / 60000),
            lastPing: this.lastPing,
            lastStatus: this.lastStatus,
            pingsSent: this.pingsSent
        };
    }
}

module.exports = new KeepAlive();
