/**
 * @file puter.js — Puter.js account linking command.
 *
 * .puter           → show link status
 * .puter link     → generate popup URL, wait for completion, auto-confirm
 * .puter unlink   → disconnect the account
 * .puter status   → detailed status
 *
 * When the user enables auto-reply via `.auto-reply on`, this flow runs
 * automatically: the bot sends the Puter popup URL into the chat, waits
 * for the user to finish registration, then posts "account linked ✅".
 */

const { startAuthSession, clearConnection, getLinkStatus, waitForToken } = require('../../utils/puterAI');

module.exports = {
    name: 'puter',
    aliases: ['puterlink', 'linkputer'],
    category: 'owner',
    ownerOnly: true,
    description: 'Link your Puter.js account for free AI (popup link + auto-confirm)',
    usage: '.puter [link|unlink|status]',

    async execute(sock, msg, args, extra) {
        try {
            const sub = (args[0] || '').toLowerCase();
            const status = getLinkStatus();

            // ── Status / default ──
            if (!sub || sub === 'status') {
                let text = `☁️ *Puter.js AI Status*\n\n`;
                text += `🔗 Linked: ${status.linked ? '✅ Yes' : '❌ No'}\n`;
                if (status.since) text += `🕐 Since: ${new Date(status.since).toLocaleString()}\n`;
                text += `📦 SDK installed: ${status.packageInstalled ? '✅' : '⚠️ No (run npm install)'}\n`;
                if (status.pending) text += `⏳ Link in progress: ${status.pendingUrl}\n`;

                text += `\n*Commands:*\n`;
                text += `• \`.puter link\` — start linking (popup URL)\n`;
                text += `• \`.puter unlink\` — disconnect\n\n`;
                text += `> _Puter gives free AI with no API key — the bot uses it for auto-reply and all AI features._`;
                return extra.reply(text);
            }

            // ── Link ──
            if (sub === 'link' || sub === 'connect' || sub === 'login') {
                if (status.linked) {
                    return extra.reply('✅ Puter account is already linked!\n\nUse `.puter unlink` first to relink.');
                }

                await extra.reply(
                    `☁️ *Puter.js Account Linking*\n\n` +
                    `⏳ Creating a secure popup link… (10-30s)\n` +
                    `The bot is waiting for you to complete registration.`
                );

                let session;
                try {
                    session = await startAuthSession({ chatId: extra.from });
                } catch (err) {
                    return extra.reply(
                        `❌ Could not create the popup link.\n` +
                        `Reason: ${err.message}\n\n` +
                        `Tunnel needs internet access + npx. On VPS/docker, ensure npx works.`
                    );
                }

                // Send the popup URL — WhatsApp shows a rich preview
                await extra.reply(
                    `🔐 *Link your Puter account:*\n\n` +
                    `👉 ${session.url}\n\n` +
                    `1️⃣ Tap the link (opens puter.com)\n` +
                    `2️⃣ Sign up / log in (free)\n` +
                    `3️⃣ You'll be redirected back — done!\n\n` +
                    `⏳ *The bot is waiting…* I'll confirm automatically the moment you finish. (5 min timeout)`
                );

                // Wait for the token capture (polls linked state)
                const result = await waitForToken(300000); // 5 minutes

                if (result === 'linked') {
                    return extra.reply(
                        `✅ *Account Linked Successfully!*\n\n` +
                        `☁️ Your Puter account is now connected to EDBots.\n` +
                        `🧠 Free AI unlocked for auto-reply and all AI features.\n\n` +
                        `Enable AI auto-reply: \`.auto-reply on\``
                    );
                }

                return extra.reply(
                    `⌛ *Linking timed out (5 min).*\n\n` +
                    `The popup link expired. Run \`.puter link\` again to get a fresh one.`
                );
            }

            // ── Unlink ──
            if (sub === 'unlink' || sub === 'disconnect' || sub === 'logout') {
                clearConnection();
                return extra.reply('🔌 Puter account disconnected. Link again with `.puter link`');
            }

            return extra.reply('❓ Usage: `.puter [link|unlink|status]`');
        } catch (err) {
            console.error('[PUTER CMD ERROR]', err);
            await extra.reply('❌ Puter command error.');
        }
    }
};
