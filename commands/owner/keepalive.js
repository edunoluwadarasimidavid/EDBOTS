/**
 * @file keepalive.js
 * @description OWNER-ONLY command that toggles the self-ping keep-alive,
 * preventing free hosting platforms from sleeping the service after
 * inactivity. State persists across restarts via data/keepAlive.json.
 *
 * Usage:
 *   .keepalive          → status
 *   .keepalive on       → start pinging every 10 minutes
 *   .keepalive off      → stop pinging
 */

const keepAlive = require('../../utils/keepAlive');

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
            // ── Status / toggle with no argument ──────────────────
            if (!action) {
                const s = keepAlive.status();
                return await reply(
                    `⏰ *Keep-Alive — ${s.enabled ? 'ON ✅' : 'OFF 💤'}*\n\n` +
                    `🔁 *Interval:* every ${s.intervalMinutes} min\n` +
                    `🎯 *Target:* ${s.target}\n` +
                    (s.lastPing
                        ? `📡 *Last ping:* ${s.lastPing} (${s.lastStatus})\n` +
                          `🔢 *Pings sent:* ${s.pingsSent}\n`
                        : '') +
                    `\n*Commands:*\n` +
                    `• \`.keepalive on\` — start pinging (server stays awake)\n` +
                    `• \`.keepalive off\` — stop pinging (host may sleep)\n` +
                    `• \`.keepalive status\` — show this panel`
                );
            }

            if (action === 'status') {
                const s = keepAlive.status();
                return await reply(
                    `⏰ *Keep-Alive — ${s.enabled ? 'ON ✅' : 'OFF 💤'}*\n\n` +
                    `🔁 *Interval:* every ${s.intervalMinutes} min\n` +
                    `🎯 *Target:* ${s.target}\n` +
                    (s.lastPing
                        ? `📡 *Last ping:* ${s.lastPing} (${s.lastStatus})\n🔢 *Pings sent:* ${s.pingsSent}`
                        : `📡 *No ping sent yet* (starts once enabled)`)
                );
            }

            if (action === 'on' || action === 'start' || action === 'enable') {
                if (keepAlive.enabled && keepAlive.timer) {
                    const s = keepAlive.status();
                    return await reply(
                        `✅ Keep-alive is *already ON*.\n\n🎯 Pinging ${s.target}\n🔁 Every ${s.intervalMinutes} min\n` +
                        (s.lastPing ? `\n📡 Last ping: ${s.lastStatus}` : '')
                    );
                }
                keepAlive.start();
                const s = keepAlive.status();
                return await reply(
                    `✅ *Keep-alive ON!*\n\n` +
                    `🔁 Pinging ${s.target} every *${s.intervalMinutes} minutes*.\n` +
                    `🛡️ Your free server will no longer sleep from inactivity.\n\n` +
                    `💤 Turn it off anytime with \`.keepalive off\`.\n` +
                    `♻️ The setting is remembered across restarts.`
                );
            }

            if (action === 'off' || action === 'stop' || action === 'disable') {
                if (!keepAlive.enabled && !keepAlive.timer) {
                    return await reply('💤 Keep-alive is *already OFF*.');
                }
                keepAlive.stop();
                return await reply(
                    `💤 *Keep-alive OFF.*\n\n` +
                    `The bot will no longer self-ping — on free hosting the service may sleep after inactivity.\n` +
                    `Turn it back on with \`.keepalive on\` anytime.`
                );
            }

            return await reply('❌ Unknown option. Use `.keepalive on`, `.keepalive off`, or `.keepalive status`.');
        } catch (error) {
            console.error('[KEEPALIVE CMD] Error:', error);
            await reply('❌ Error managing keep-alive.');
        }
    }
};
