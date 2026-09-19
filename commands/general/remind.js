/**
 * Smart Reminder Command - Natural language reminders
 * Supports: .remind me in 30 minutes to call mom
 *           .remind tomorrow at 9am meeting
 *           .remind every monday to check emails
 */

const fs = require('fs');
const path = require('path');

const REMINDERS_FILE = path.join(__dirname, '../../data/smartReminders.json');

function loadReminders() {
    try {
        if (!fs.existsSync(REMINDERS_FILE)) return [];
        return JSON.parse(fs.readFileSync(REMINDERS_FILE, 'utf8'));
    } catch (e) { return []; }
}

function saveReminders(data) {
    try {
        const dir = path.dirname(REMINDERS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(REMINDERS_FILE, JSON.stringify(data, null, 2));
    } catch (e) {}
}

/**
 * Parse natural language time expressions
 */
function parseNaturalTime(text) {
    const now = Date.now();
    const lower = text.toLowerCase();

    // "in X minutes/hours/days"
    const inMatch = lower.match(/in\s+(\d+)\s+(minute|minutes|min|mins|hour|hours|hr|hrs|day|days)/);
    if (inMatch) {
        const num = parseInt(inMatch[1]);
        const unit = inMatch[2];
        if (unit.startsWith('min')) return now + num * 60 * 1000;
        if (unit.startsWith('hour') || unit.startsWith('hr')) return now + num * 60 * 60 * 1000;
        if (unit.startsWith('day')) return now + num * 24 * 60 * 60 * 1000;
    }

    // "tomorrow at X"
    const tomorrowMatch = lower.match(/tomorrow\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (tomorrowMatch) {
        let hour = parseInt(tomorrowMatch[1]);
        const min = parseInt(tomorrowMatch[2] || '0');
        const ampm = tomorrowMatch[3];
        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
        const tomorrow = new Date(now + 24 * 60 * 60 * 1000);
        tomorrow.setHours(hour, min, 0, 0);
        return tomorrow.getTime();
    }

    // "every X minutes/hours/days"
    const everyMatch = lower.match(/every\s+(\d+)\s+(minute|minutes|hour|hours|day|days)/);
    if (everyMatch) {
        const num = parseInt(everyMatch[1]);
        const unit = everyMatch[2];
        if (unit.startsWith('minute')) return { interval: num * 60 * 1000, recurring: true };
        if (unit.startsWith('hour')) return { interval: num * 60 * 60 * 1000, recurring: true };
        if (unit.startsWith('day')) return { interval: num * 24 * 60 * 60 * 1000, recurring: true };
    }

    // "at X:XX am/pm"
    const atMatch = lower.match(/(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?/);
    if (atMatch) {
        let hour = parseInt(atMatch[1]);
        const min = parseInt(atMatch[2]);
        const ampm = atMatch[3];
        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
        const target = new Date(now);
        target.setHours(hour, min, 0, 0);
        if (target.getTime() <= now) target.setDate(target.getDate() + 1);
        return target.getTime();
    }

    return null;
}

module.exports = {
    name: 'remind',
    aliases: ['remindme', 'reminder', 'rem'],
    category: 'utility',
    description: 'Set smart reminders with natural language',
    usage: '.remind me in 30 minutes to call mom',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                const reminders = loadReminders().filter(r => r.userId === extra.sender);
                let text = `⏰ *Smart Reminders*\n\n`;

                if (reminders.length > 0) {
                    text += `*Your Active Reminders:*\n`;
                    reminders.forEach((r, i) => {
                        const timeLeft = r.triggerAt - Date.now();
                        const timeStr = timeLeft > 0 ? formatDuration(timeLeft) : 'Overdue';
                        text += `${i + 1}. ${r.message}\n   ⏰ ${timeStr} left\n`;
                    });
                    text += `\n*Manage:*\n• \`.remind cancel <number>\` - Cancel reminder\n• \`.remind clear\` - Clear all\n\n`;
                }

                text += `*Set a Reminder:*\n`;
                text += `• \`.remind me in 30 minutes to call mom\`\n`;
                text += `• \`.remind tomorrow at 9am meeting\`\n`;
                text += `• \`.remind in 2 hours check emails\`\n`;
                text += `• \`.remind every day at 8am exercise\``;

                return extra.reply(text);
            }

            // Cancel reminder
            if (args[0] === 'cancel' || args[0] === 'delete') {
                const idx = parseInt(args[1]) - 1;
                const reminders = loadReminders();
                const userReminders = reminders.filter(r => r.userId === extra.sender);
                if (isNaN(idx) || idx < 0 || idx >= userReminders.length) {
                    return extra.reply('❌ Invalid number. Use \`.remind\` to see your reminders.');
                }
                const toDelete = userReminders[idx];
                const newReminders = reminders.filter(r => r.id !== toDelete.id);
                saveReminders(newReminders);
                return extra.reply(`✅ Cancelled: *${toDelete.message}*`);
            }

            // Clear all
            if (args[0] === 'clear') {
                const reminders = loadReminders().filter(r => r.userId !== extra.sender);
                saveReminders(reminders);
                return extra.reply('✅ All your reminders cleared.');
            }

            // Parse the reminder
            const fullText = args.join(' ');
            const timeResult = parseNaturalTime(fullText);

            if (!timeResult || (typeof timeResult === 'object' && timeResult.recurring)) {
                return extra.reply(
                    `❌ I couldn't understand the time. Try:\n` +
                    `• \`.remind me in 30 minutes to do something\`\n` +
                    `• \`.remind tomorrow at 9am something\`\n` +
                    `• \`.remind in 2 hours something\``
                );
            }

            const triggerAt = typeof timeResult === 'number' ? timeResult : timeResult;
            const message = fullText.replace(/^(me\s+)?(in\s+\d+\s+\w+|tomorrow\s+.+|at\s+\d+.+)/i, '').trim() || 'Reminder';

            const reminder = {
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
                userId: extra.sender,
                chatId: extra.from,
                message,
                triggerAt,
                createdAt: Date.now()
            };

            const reminders = loadReminders();
            reminders.push(reminder);
            saveReminders(reminders);

            // Schedule
            const delay = triggerAt - Date.now();
            setTimeout(async () => {
                try {
                    const current = loadReminders();
                    const still = current.find(r => r.id === reminder.id);
                    if (!still) return;
                    saveReminders(current.filter(r => r.id !== reminder.id));

                    await sock.sendMessage(reminder.chatId, {
                        text: `⏰ *Reminder!*\n\n@${reminder.userId.split('@')[0]}, you asked me to remind you:\n\n💡 *${reminder.message}*`,
                        mentions: [reminder.userId]
                    });
                } catch (e) {}
            }, Math.min(delay, 2147483647)); // Max setTimeout value

            const timeStr = formatDuration(delay);
            await extra.reply(
                `✅ *Reminder Set!*\n\n` +
                `📝 ${message}\n` +
                `⏰ Will remind you in: *${timeStr}*\n` +
                `🕐 At: ${new Date(triggerAt).toLocaleString()}`
            );

        } catch (error) {
            console.error('[REMIND ERROR]', error);
            await extra.reply('❌ Error setting reminder.');
        }
    }
};

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m ${seconds % 60}s`;
}
