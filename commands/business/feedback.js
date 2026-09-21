/**
 * @file feedback.js — Customer feedback collection for business mode.
 *
 * Customers type:  .feedback <message>
 * Business owner receives it with contact info, stored in data/feedback.json
 * Owner reviews:   .feedback list / .feedback clear (owner-only)
 */

const fs = require('fs');
const path = require('path');

const FEEDBACK_FILE = path.join(__dirname, '../../data/feedback.json');

function loadFeedback() {
    try {
        if (!fs.existsSync(FEEDBACK_FILE)) return {};
        return JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
    } catch (e) { return {}; }
}

function saveFeedback(data) {
    try {
        const dir = path.dirname(FEEDBACK_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(data, null, 2));
    } catch (e) {}
}

module.exports = {
    name: 'feedback',
    category: 'business',
    description: 'Send feedback to the business, or review feedback received',
    usage: '.feedback <message>  ·  .feedback list (owner)',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            const chatId = extra.from;
            const sender = msg.key.participant || msg.key.remoteJid;
            const senderName = msg.pushName || sender.split('@')[0];
            const text = args.join(' ').trim();

            // ── Owner review mode ──
            if ((args[0] || '').toLowerCase() === 'list' && extra.isOwner) {
                const all = loadFeedback();
                const entries = all[chatId] || [];

                if (entries.length === 0) {
                    return extra.reply('📭 No feedback received yet.');
                }

                let out = `📮 *Customer Feedback* (${entries.length})\n\n`;
                entries.slice(-10).forEach((f, i) => {
                    const stars = '⭐'.repeat(f.rating || 0);
                    out += `${entries.length - Math.min(entries.length, 10) + i + 1}. ${stars}${f.rating ? ' ' : ''}*${f.name}*\n`;
                    out += `   "${f.message.substring(0, 120)}"\n`;
                    out += `   🕐 ${new Date(f.time).toLocaleString()}\n\n`;
                });
                return extra.reply(out);
            }

            if ((args[0] || '').toLowerCase() === 'clear' && extra.isOwner) {
                const all = loadFeedback();
                delete all[chatId];
                saveFeedback(all);
                return extra.reply('🗑️ Feedback cleared.');
            }

            // ── Customer submission ──
            if (!text) {
                return extra.reply(
                    `📮 *Send us feedback!*\n\n` +
                    `Usage: \`.feedback <your message>\`\n\n` +
                    `Example: \`.feedback Great service, fast delivery!\`\n\n` +
                    `Your message goes directly to the business owner.`
                );
            }

            // Store feedback
            const all = loadFeedback();
            if (!all[chatId]) all[chatId] = [];
            all[chatId].push({
                from: sender,
                name: senderName,
                message: text,
                time: Date.now()
            });
            // Keep last 100 per chat
            if (all[chatId].length > 100) all[chatId] = all[chatId].slice(-100);
            saveFeedback(all);

            await extra.reply(
                `✅ *Feedback received!*\n\n` +
                `Thank you, ${senderName}! 🙏\n` +
                `Your message has been delivered to the business owner.\n\n` +
                `"${text}"`
            );

            // Notify the owner if this is not the owner's own chat
            try {
                if (!extra.isOwner && extra.ownerJid) {
                    await sock.sendMessage(extra.ownerJid, {
                        text:
                            `📮 *New Feedback*\n\n` +
                            `👤 From: ${senderName} (${sender.split('@')[0]})\n` +
                            `💬 "${text}"\n\n` +
                            `Review all: \`.feedback list\``
                    });
                }
            } catch (e) { /* owner notification optional */ }
        } catch (err) {
            console.error('[FEEDBACK ERROR]', err.message);
            await extra.reply('❌ Could not submit feedback.');
        }
    }
};
