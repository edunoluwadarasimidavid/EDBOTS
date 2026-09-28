/**
 * @file keepalive.js
 * @description OWNER-ONLY keep-alive control with an honest status panel.
 *
 * Usage:
 *   .keepalive            → status panel
 *   .keepalive on         → enable (shows detection results + first ping)
 *   .keepalive status     → status panel + ping statistics
 *   .keepalive off        → stop cleanly and persist
 *
 * The panel always distinguishes DETECTED vs INFERRED vs VERIFIED:
 * - Platform-provided URLs are shown with HIGH confidence (the host told us).
 * - A public-IP-derived URL is only ever shown as an UNVERIFIED candidate
 *   with an explicit warning — egress IP does not mean the port is open.
 * - "Reachability: VERIFIED" appears only after a real HTTP request to the
 *   health endpoint actually succeeded.
 */

const keepAlive = require('../../utils/keepAlive');

const BOX_W = 38;

function boxHeader() {
    const title = 'EDBOTS KEEPALIVE';
    const inner = Math.floor((BOX_W - 2 - title.length) / 2);
    return (
        `╭${'─'.repeat(BOX_W - 2)}╮\n` +
        `│${' '.repeat(inner)}${title}${' '.repeat(BOX_W - 2 - inner - title.length)}│\n` +
        `╰${'─'.repeat(BOX_W - 2)}╯`
    );
}

function row(label, value) {
    return `${label.padEnd(14)}: ${value}`;
}

function sourceLabel(s) {
    switch (s) {
        case 'explicit': return 'Owner config (KEEPALIVE_URL)';
        case 'environment': return 'config.js (owner)';
        case 'platform': return 'Hosting Environment';
        case 'public-ip': return 'Public IP (inferred)';
        default: return 'None';
    }
}

function reachabilityLabel(st) {
    if (st.targetKind === 'loopback') return 'INTERNAL ONLY';
    if (st.targetKind === 'explicit-local') return 'INTERNAL (owner-pinned)';
    if (!st.lastPingAt) return 'UNVERIFIED';
    if (st.consecutiveFailures === 0) return `VERIFIED (HTTP ${st.lastStatusCode}, ${st.lastLatencyMs}ms)`;
    return `FAILED — ${st.lastError}`;
}

/** Build the full status panel from a keepAlive.status() snapshot. */
function renderPanel(st, { showStats = false, headline = null } = {}) {
    const ep = st.endpoint || {};
    const lines = [];

    lines.push(boxHeader());
    lines.push('');
    if (headline) lines.push(headline, '');
    lines.push(row('Status', st.enabled ? 'ENABLED ✅' : 'DISABLED 💤'));
    lines.push(row('Environment', ep.source && ep.source !== 'unknown' ? 'Detected' : 'Not detected'));
    lines.push(row('Local Host', ep.localHost || '0.0.0.0'));
    lines.push(row('Local Port', String(ep.localPort || '')));
    lines.push(row('Local URL', ep.localUrl || ''));
    lines.push('');
    lines.push(row('Public Host', ep.publicHost || 'Not detected'));
    lines.push(row('Public URL', ep.publicUrl || 'Not detected'));
    lines.push(row('URL Source', sourceLabel(ep.source)));
    lines.push(row('Confidence', (ep.confidence || 'unknown').toUpperCase()));
    lines.push(row('Reachability', reachabilityLabel(st)));
    lines.push('');
    lines.push(row('Health Target', st.target || '—'));
    lines.push(row('Interval', `${st.intervalMinutes} minutes`));

    // ── Honest notes ───────────────────────────────────────────────
    if (st.targetKind === 'loopback') {
        lines.push('');
        if (ep.publicUrl && ep.unverifiedCandidate) {
            lines.push(`⚠️ WARNING: The address above was inferred from the server's public IP.`);
            lines.push(`The hosting provider may block direct access to this port.`);
            lines.push(`It could not be verified, so the internal endpoint is used instead.`);
        } else {
            lines.push(`The server is running locally, but EDBOTS could not`);
            lines.push(`determine a publicly reachable URL automatically.`);
            lines.push(`KeepAlive cannot reliably ping an external URL on this host.`);
        }
        lines.push('');
        lines.push(`The internal ping keeps the process active, but sleep`);
        lines.push(`protection is NOT guaranteed. Set KEEPALIVE_URL=https://your-domain`);
        lines.push(`to pin your real public URL (it always wins over detection).`);
    } else if (st.targetKind === 'explicit-local') {
        lines.push('');
        lines.push(`ℹ️ Your KEEPALIVE_URL points at an internal address.`); 
        lines.push(`Pings exercise the API locally (useful for development), but a`);
        lines.push(`sleeping free host only stays awake from PUBLIC traffic.`);
        lines.push(`Set KEEPALIVE_URL=https://your-public-domain for sleep protection.`);
    } else if (!st.lastPingAt) {
        lines.push('');
        lines.push(`First ping in progress — reachability will be confirmed shortly.`);
    } else if (st.consecutiveFailures > 0) {
        lines.push('');
        lines.push(`⚠️ The health endpoint is not answering (ping will keep retrying).`);
        lines.push(`If this persists, the URL may be wrong — check KEEPALIVE_URL.`);
    }

    if (showStats) {
        lines.push('');
        lines.push(`── Ping statistics ${'─'.repeat(Math.max(2, BOX_W - 21))}`);
        lines.push(row('Pings sent', `${st.pingsSent} (ok ${st.pingsOk} / failed ${st.pingsFailed})`));
        lines.push(row('Last ping', st.lastPingAt || 'never'));
        lines.push(row('Last response', st.lastStatusCode ? `HTTP ${st.lastStatusCode}` : (st.lastError || '—')));
        lines.push(row('Response time', st.lastLatencyMs != null ? `${st.lastLatencyMs} ms` : '—'));
        lines.push(row('Fail streak', st.consecutiveFailures === 0 ? 'none' : `${st.consecutiveFailures} consecutive`));
        lines.push(row('Scheduler', st.running ? 'running (single instance)' : 'stopped'));
    }

    return lines.join('\n');
}

module.exports = {
    name: 'keepalive',
    aliases: ['stayawake', 'nosleep'],
    category: 'owner',
    description: 'Keep the free server awake with self-pings (owner only)',
    usage: '.keepalive <on/off/status>',
    isOwner: true,

    async handler(context) {
        const { args, reply } = context;
        const action = (args[0] || '').toLowerCase().trim();

        try {
            // ── .keepalive on ──────────────────────────────────────
            if (['on', 'start', 'enable'].includes(action)) {
                if (keepAlive.timer) {
                    const st = keepAlive.status();
                    return await reply(renderPanel(st, { headline: '✅ KeepAlive is already active.' }));
                }
                const st = await keepAlive.start(); // resolves after first ping
                return await reply(renderPanel(st, { headline: 'KeepAlive is active.' }));
            }

            // ── .keepalive off ─────────────────────────────────────
            if (['off', 'stop', 'disable'].includes(action)) {
                if (!keepAlive.timer && !keepAlive.enabled) {
                    return await reply('💤 KeepAlive is *already OFF*. Nothing is scheduled.');
                }
                keepAlive.stop();
                return await reply(
                    '💤 *KeepAlive OFF.*\n\n' +
                    'Scheduler cleared and the disabled state saved — restarts will keep it off.\n' +
                    'On free hosting, the service may sleep after inactivity.\n' +
                    'Turn it back on anytime with `.keepalive on`.'
                );
            }

            // ── .keepalive status / bare ───────────────────────────
            if (!action || action === 'status') {
                const st = keepAlive.status();
                if (action === 'status' && !st.enabled && !st.target) {
                    // Ask for detection data so the panel is still informative
                    const fresh = await keepAlive.resolveTarget().then(() => keepAlive.status());
                    return await reply(renderPanel(fresh, { showStats: true, headline: 'ℹ️ KeepAlive is currently disabled.' }));
                }
                return await reply(renderPanel(st, { showStats: true }));
            }

            return await reply('❌ Unknown option. Use `.keepalive on`, `.keepalive off`, or `.keepalive status`.');
        } catch (error) {
            console.error('[KEEPALIVE CMD] Error:', error);
            await reply('❌ Error managing keep-alive.');
        }
    }
};
