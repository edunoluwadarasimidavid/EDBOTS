/**
 * @file booking.js — Appointment/booking system for business mode.
 *
 * Customers:   .book <date> <time> <service>
 * Owner views: .book list (owner-only)
 * Owner acts:  .book confirm/reject <number> (owner-only)
 */

const fs = require('fs');
const path = require('path');

const BOOKINGS_FILE = path.join(__dirname, '../../data/bookings.json');

function loadBookings() {
    try {
        if (!fs.existsSync(BOOKINGS_FILE)) return {};
        return JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8'));
    } catch (e) { return {}; }
}

function saveBookings(data) {
    try {
        const dir = path.dirname(BOOKINGS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(data, null, 2));
    } catch (e) {}
}

module.exports = {
    name: 'book',
    aliases: ['booking', 'appointment'],
    category: 'business',
    description: 'Book an appointment, or manage bookings (owner)',
    usage: '.book <date> <time> <service>  ·  .book list (owner)',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            const chatId = extra.from;
            const sender = msg.key.participant || msg.key.remoteJid;
            const senderName = msg.pushName || sender.split('@')[0];
            const sub = (args[0] || '').toLowerCase();

            // ── Owner: list bookings ──
            if (sub === 'list' && extra.isOwner) {
                const all = loadBookings();
                const list = all[chatId] || [];

                if (list.length === 0) {
                    return extra.reply('📅 No bookings yet.');
                }

                let out = `📅 *Bookings* (${list.length})\n\n`;
                list.forEach((b, i) => {
                    const icon = b.status === 'confirmed' ? '✅' : b.status === 'rejected' ? '❌' : '⏳';
                    out += `${icon} *#${i + 1}* ${b.date} @ ${b.time}\n`;
                    out += `   👤 ${b.name} — ${b.service}\n\n`;
                });
                out += `Confirm: \`.book confirm 2\`\nReject: \`.book reject 2\``;
                return extra.reply(out);
            }

            if ((sub === 'confirm' || sub === 'reject') && extra.isOwner) {
                const idx = parseInt(args[1], 10) - 1;
                const all = loadBookings();
                const list = all[chatId] || [];

                if (isNaN(idx) || !list[idx]) {
                    return extra.reply('❌ Invalid booking number. Use `.book list`');
                }

                list[idx].status = sub === 'confirm' ? 'confirmed' : 'rejected';
                saveBookings(all);

                const icon = sub === 'confirm' ? '✅' : '❌';
                try {
                    await sock.sendMessage(list[idx].from + '@s.whatsapp.net', {
                        text: `${icon} *Booking ${sub === 'confirm' ? 'Confirmed' : 'Declined'}*\n\n` +
                            `📅 ${list[idx].date} @ ${list[idx].time}\n` +
                            `🛎️ ${list[idx].service}\n\n` +
                            (sub === 'confirm' ? `See you then! 🎉` : `Please contact us to reschedule.`)
                    });
                } catch (e) { /* customer may not be contactable */ }

                return extra.reply(`${icon} Booking #${idx + 1} ${sub === 'confirm' ? 'confirmed' : 'rejected'} and customer notified.`);
            }

            // ── Customer: new booking ──
            if (!sub || isNaN(new Date(`${args[0]} ${args[1]}`).getTime())) {
                return extra.reply(
                    `📅 *Book an Appointment*\n\n` +
                    `Usage: \`.book <YYYY-MM-DD> <HH:MM> <service>\`\n\n` +
                    `Example:\n\`.book 2026-09-25 14:30 Haircut\`\n\n` +
                    `The business will confirm your booking. ⏳`
                );
            }

            const date = args[0];
            const time = args[1];
            const service = args.slice(2).join(' ') || 'General appointment';

            const all = loadBookings();
            if (!all[chatId]) all[chatId] = [];
            all[chatId].push({
                from: sender.split('@')[0],
                name: senderName,
                date,
                time,
                service,
                status: 'pending',
                createdAt: Date.now()
            });
            saveBookings(all);

            await extra.reply(
                `⏳ *Booking Request Sent!*\n\n` +
                `📅 ${date} @ ${time}\n` +
                `🛎️ ${service}\n` +
                `👤 ${senderName}\n\n` +
                `You'll receive a confirmation shortly. ✨`
            );
        } catch (err) {
            console.error('[BOOK ERROR]', err.message);
            await extra.reply('❌ Booking failed. Try: `.book 2026-09-25 14:30 Service`');
        }
    }
};
