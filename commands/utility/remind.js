/**
 * Remind Command - Set reminders that trigger later
 * Usage: .remind <time> <message>
 * Examples: .remind 30m Call mom
 *           .remind 2h Meeting with team
 *           .remind 1d Birthday party tomorrow
 */

const fs = require('fs');
const path = require('path');
const config = require('../../config');

const REMINDERS_FILE = path.join(__dirname, '../../data/reminders.json');
const MAX_REMINDERS_PER_USER = 10;

function loadReminders() {
    try {
        if (!fs.existsSync(REMINDERS_FILE)) {
            fs.writeFileSync(REMINDERS_FILE, JSON.stringify([]));
            return [];
        }
        return JSON.parse(fs.readFileSync(REMINDERS_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function saveReminders(reminders) {
    try {
        const dir = path.dirname(REMINDERS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
    } catch (e) {
        console.error('[REMIND] Save error:', e);
    }
}

function parseTime(str) {
    const match = str.match(/^(\d+)(m|h|d|s)$/i);
    if (!match) return null;
    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    switch (unit) {
        case 's': return num * 1000;
        case 'm': return num * 60 * 1000;
        case 'h': return num * 60 * 60 * 1000;
        case 'd': return num * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

module.exports = {
    name: 'remind',
    aliases: ['remindme', 'reminder', 'rem'],
    category: 'utility',
    description: 'Set a reminder',
    usage: '.remind <time> <message> (e.g., .remind 30m Call mom)',
    groupOnly: false,

    async execute(sock, msg, args, extra) {
        try {
            if (args.length < 2) {
                return extra.reply(
                    `⏰ *Reminder System*\n\n` +
                    `Usage: .remind <time> <message>\n\n` +
                    `*Time formats:*\n` +
                    `• \`30s\` - 30 seconds\n` +
                    `• \`15m\` - 15 minutes\n` +
                    `• \`2h\` - 2 hours\n` +
                    `• \`1d\` - 1 day\n\n` +
                    `*Examples:*\n` +
                    `• \`.remind 30m Call mom\`\n` +
                    `• \`.remind 2h Meeting with team\`\n` +
                    `• \`.remind 1d Buy groceries\`\n\n` +
                    `*List your reminders:* \`.remind list\`\n` +
                    `*Delete a reminder:* \`.remind del <number>\``
                );
            }

            const timeStr = args[0].toLowerCase();

            // List reminders
            if (timeStr === 'list' || timeStr === 'ls') {
                const reminders = loadReminders();
                const userReminders = reminders.filter(r => r.userId === extra.sender);

                if (userReminders.length === 0) {
                    return extra.reply('⏰ You have no active reminders.');
                }

                let text = `⏰ *Your Reminders (${userReminders.length}):*\n\n`;
                userReminders.forEach((r, i) => {
                    const remaining = formatTime(r.triggerAt - Date.now());
                    text += `${i + 1}. ⏳ ${r.message}\n   └ Time left: ${remaining}\n`;
                });
                return extra.reply(text);
            }

            // Delete reminder
            if (timeStr === 'del' || timeStr === 'delete' || timeStr === 'rm') {
                const reminders = loadReminders();
                const userReminders = reminders.filter(r => r.userId === extra.sender);
                const idx = parseInt(args[1]) - 1;

                if (isNaN(idx) || idx < 0 || idx >= userReminders.length) {
                    return extra.reply('❌ Invalid reminder number. Use `.remind list` to see your reminders.');
                }

                const toDelete = userReminders[idx];
                const newReminders = reminders.filter(r => r.id !== toDelete.id);
                saveReminders(newReminders);
                return extra.reply(`✅ Reminder deleted: *${toDelete.message}*`);
            }

            // Set reminder
            const delayMs = parseTime(args[0]);
            if (!delayMs) {
                return extra.reply('❌ Invalid time format. Use `30s`, `15m`, `2h`, or `1d`.');
            }

            const message = args.slice(1).join(' ');
            const reminders = loadReminders();

            // Check limit
            const userReminders = reminders.filter(r => r.userId === extra.sender);
            if (userReminders.length >= MAX_REMINDERS_PER_USER) {
                return extra.reply(`❌ You have reached the maximum of ${MAX_REMINDERS_PER_USER} reminders. Delete one first with \`.remind list\` then \`.remind del <number>\``);
            }

            const reminder = {
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                userId: extra.sender,
                chatId: extra.from,
                message,
                triggerAt: Date.now() + delayMs,
                createdAt: Date.now()
            };

            reminders.push(reminder);
            saveReminders(reminders);

            // Schedule the reminder
            setTimeout(async () => {
                try {
                    const currentReminders = loadReminders();
                    const stillExists = currentReminders.find(r => r.id === reminder.id);
                    if (!stillExists) return; // Was deleted

                    // Remove after firing
                    const updated = currentReminders.filter(r => r.id !== reminder.id);
                    saveReminders(updated);

                    const senderName = `@${extra.sender.split('@')[0]}`;
                    await sock.sendMessage(reminder.chatId, {
                        text: `⏰ *Reminder!*\n\nHey ${senderName}! You asked me to remind you:\n\n💡 *${reminder.message}*\n\n> Set ${formatTime(Date.now() - reminder.createdAt)} ago`,
                        mentions: [reminder.userId]
                    });
                } catch (e) {
                    console.error('[REMIND] Send error:', e);
                }
            }, delayMs);

            const fireAt = new Date(Date.now() + delayMs).toLocaleTimeString();
            await extra.reply(
                `✅ *Reminder Set!*\n\n` +
                `📝 Message: *${message}*\n` +
                `⏰ Will remind you in: *${formatTime(delayMs)}*\n` +
                `🕐 At approximately: *${fireAt}*`
            );

        } catch (error) {
            console.error('[REMIND ERROR]', error);
            await extra.reply('❌ Error setting reminder.');
        }
    }
};
