/**
 * @file keepAlive.js
 * @description Owner-controlled keep-alive for free hosting tiers.
 *
 * WHAT IT DOES
 * Every KEEPALIVE_INTERVAL (default 10 min) it sends ONE real GET request to
 * this server's own public health endpoint (platform URL when detectable,
 * loopback as an honest fallback). Real inbound HTTP keeps platforms like
 * Render/Railway/Koyeb from sleeping the service.
 *
 * HONESTY RULES
 * - Local bind info (0.0.0.0 / PORT / 127.0.0.1) is NEVER presented as public.
 * - Platform URLs (from RENDER_EXTERNAL_URL, RAILWAY_PUBLIC_DOMAIN, …) are
 *   used WITHOUT the internal port — reverse proxies serve them on 443.
 * - A public IP is an UNVERIFIED candidate only (egress IP ≠ open port); it
 *   is used only after a one-shot verification, otherwise we say so plainly.
 * - KEEPALIVE_URL (owner override) always wins over automatic detection.
 *
 * SAFETY
 * - Single scheduler (start() is idempotent), timer unref'd (PM2-safe),
 *   clean clearInterval on stop, persisted enabled state, no dependencies.
 */

const fs = require('fs');
const path = require('path');
const { detectPublicEndpoint, verifyEndpoint, HEALTH_PATH, localInfo } = require('./publicEndpoint');

const STATE_FILE = path.join(__dirname, '..', 'data', 'keepAlive.json');

/** Interval bounds: never hammer the server, never risk platform timeouts. */
const MIN_INTERVAL_MS = 60 * 1000;        // 1 min
const MAX_INTERVAL_MS = 30 * 60 * 1000;   // 30 min
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000; // 10 min

class KeepAlive {
    constructor() {
        this.timer = null;
        this.enabled = false;
        this.intervalMs = this.readIntervals();
        this.target = null;          // URL actually being pinged
        this.targetKind = null;      // 'public' | 'public-unverified' | 'loopback'
        this.endpoint = null;        // last detectPublicEndpoint() result
        this.pingsSent = 0;
        this.pingsOk = 0;
        this.pingsFailed = 0;
        this.consecutiveFailures = 0;
        this.lastPingAt = null;
        this.lastLatencyMs = null;
        this.lastStatusCode = null;
        this.lastError = null;
        this.verification = null;    // one-shot verify result for the panel
    }

    // ── Configuration ──────────────────────────────────────────────
    readIntervals() {
        const raw = parseInt(process.env.KEEPALIVE_INTERVAL || process.env.KEEP_ALIVE_INTERVAL || '', 10);
        if (!Number.isFinite(raw)) return DEFAULT_INTERVAL_MS;
        return Math.min(Math.max(raw, MIN_INTERVAL_MS), MAX_INTERVAL_MS);
    }

    // ── Persistence (survives restarts / PM2 reloads) ──────────────
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

    // ── Endpoint resolution ────────────────────────────────────────
    /**
     * Decide WHAT to ping. Returns the endpoint detection plus the final
     * target decision. Never throws.
     */
    async resolveTarget() {
        const endpoint = await detectPublicEndpoint().catch(() => null);
        this.endpoint = endpoint || localInfo();

        // 1. Owner-provided URL ALWAYS wins (spec: explicit config first).
        //    If the owner pointed at an internal address (localhost, docker
        //    service name), we still honor it — but label it explicitly so
        //    the panel never calls an internal URL "public".
        if (endpoint && endpoint.source === 'explicit' && endpoint.publicUrl) {
            this.target = endpoint.publicUrl + HEALTH_PATH;
            this.targetKind = endpoint.explicitLocal ? 'explicit-local' : 'public';
            return { endpoint, target: this.target, kind: this.targetKind };
        }

        // 2. Trusted platform/config URL (no port appended — reverse proxy)
        if (endpoint && endpoint.publicUrl && !endpoint.unverifiedCandidate) {
            this.target = endpoint.publicUrl + HEALTH_PATH;
            this.targetKind = 'public';
            return { endpoint, target: this.target, kind: this.targetKind };
        }

        // 3. Public-IP candidate: verify ONCE before trusting it. If the
        //    port really answers, promote it; otherwise fall back honestly.
        if (endpoint && endpoint.publicUrl && endpoint.unverifiedCandidate) {
            const check = await verifyEndpoint(endpoint.publicUrl + HEALTH_PATH, 6000);
            this.verification = { url: endpoint.publicUrl + HEALTH_PATH, ...check };
            if (check.reachable) {
                this.target = endpoint.publicUrl + HEALTH_PATH;
                this.targetKind = 'public';
                this.endpoint.confidence = 'medium'; // promoted by verification
                this.endpoint.externallyReachable = true;
                return { endpoint: this.endpoint, target: this.target, kind: this.targetKind };
            }
            // Not reachable → do NOT pretend. Loopback keeps the process warm;
            // the panel will tell the owner the public URL could not be used.
        }

        // 4. Honest fallback: internal self-request (keeps Node active; some
        //    platforms still count it, but it is NOT a public ping).
        this.target = localInfo().healthUrl;
        this.targetKind = 'loopback';
        return { endpoint: this.endpoint, target: this.target, kind: this.targetKind };
    }

    // ── Ping ───────────────────────────────────────────────────────
    /** One ping cycle. Awaiting it gives the caller the verification result. */
    async pingNow() {
        if (!this.target) await this.resolveTarget();

        const result = await verifyEndpoint(this.target, 8000);
        this.pingsSent++;
        this.lastPingAt = new Date().toISOString();
        this.lastLatencyMs = result.latencyMs;
        this.lastStatusCode = result.status;

        if (result.reachable) {
            this.pingsOk++;
            this.consecutiveFailures = 0;
            this.lastError = null;
        } else {
            this.pingsFailed++;
            this.consecutiveFailures++;
            this.lastError = result.reason || `HTTP ${result.status}`;
        }
        return result;
    }

    // ── Scheduler ──────────────────────────────────────────────────
    /**
     * Start (idempotent — never creates a second interval, PM2 restart-safe).
     * Resolves after the FIRST ping completes so callers can report a real
     * verification result instead of a promise.
     */
    start(silent = false) {
        if (this.timer) return Promise.resolve(this.status()); // already running
        this.enabled = true;
        this.save();

        // Scheduler first, then resolve/ping asynchronously
        this.timer = setInterval(() => {
            this.pingNow().catch((e) =>
                console.error('[KEEP-ALIVE] ping error:', e && e.message ? e.message : e)
            );
        }, this.intervalMs);
        if (this.timer.unref) this.timer.unref(); // never hold the process open (PM2-safe)

        return this.resolveTarget()
            .then(({ target, kind }) => {
                if (!silent) {
                    console.log(
                        `\x1b[32m[KEEP-ALIVE] ✅ Started — ${kind === 'loopback' ? 'internal' : 'public'} ping every ${Math.round(this.intervalMs / 60000)} min → ${target}\x1b[0m`
                    );
                }
                return this.pingNow();
            })
            .then(() => this.status())
            .catch((e) => {
                console.error('[KEEP-ALIVE] startup error:', e && e.message ? e.message : e);
                return this.status();
            });
    }

    /** Stop cleanly and persist the disabled state. */
    stop(silent = false) {
        this.enabled = false;
        this.save();
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (!silent) {
            console.log('\x1b[33m[KEEP-ALIVE] 💤 Stopped — scheduler cleared\x1b[0m');
        }
    }

    /** Restore the persisted preference (called on every WhatsApp connect). */
    restore() {
        this.load();
        if (this.enabled) this.start(true);
    }

    // ── Reporting ──────────────────────────────────────────────────
    status() {
        return {
            enabled: this.enabled,
            running: !!this.timer,
            intervalMinutes: Math.round(this.intervalMs / 60000),
            target: this.target,
            targetKind: this.targetKind,
            healthPath: HEALTH_PATH,
            endpoint: this.endpoint,
            verification: this.verification,
            lastPingAt: this.lastPingAt,
            lastLatencyMs: this.lastLatencyMs,
            lastStatusCode: this.lastStatusCode,
            lastError: this.lastError,
            consecutiveFailures: this.consecutiveFailures,
            pingsSent: this.pingsSent,
            pingsOk: this.pingsOk,
            pingsFailed: this.pingsFailed
        };
    }
}

module.exports = new KeepAlive();
