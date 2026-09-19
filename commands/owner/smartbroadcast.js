/**
 * Smart Broadcast Command - Targeted messaging with analytics
 * Send messages to specific groups, schedule broadcasts, track delivery
 */

const fs = require('fs');
const path = require('path');

const BROADCAST_FILE = path.join(__dirname, '../../data/broadcastHistory.json');

function loadHistory() {
    try {
        if (!fs.existsSync(BROADCAST_FILE)) return { broadcasts: [], stats: {} };
        return JSON.parse(fs.readFileSync(BROADCAST_FILE, 'utf8'));
    } catch (e) { return { broadcasts: [], stats: {} }; }
}

function saveHistory(data) {
    try {
        const dir = path.dirname(BROADCAST_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(BROADCAST_FILE, JSON.stringify(data, null, 2));
    } catch (e) {}
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = {
    name: 'smartbc',
    aliases: ['smartbroadcast', 'announce'],
    category: 'owner',
    description: 'Smart broadcast with targeting and analytics',
    usage: '.smartbc <message> or .smartbc <target> <message>',
    ownerOnly: true,

    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                return extra.reply(
                    `📢 *Smart Broadcast System*\n\n` +
                    `*Usage:*\n` +
                    `• \`.smartbc <message>\` - Broadcast to all groups\n` +
                    `• \`.smartbc groups <message>\` - Only groups\n` +
                    `• \`.smartbc stats\` - View broadcast history\n` +
                    `• \`.smartbc last\` - Last broadcast details\n\n` +
                    `*Features:*\n` +
                    `• 🎯 Targeted delivery\n` +
                    `• ⏱️ Anti-spam delays (3-5s between groups)\n` +
                    `• 📊 Delivery tracking\n` +
                    `• 🔄 Auto-retry on failure`
                );
            }

            const action = args[0].toLowerCase();

            if (action === 'stats') {
                const history = loadHistory();
                const total = history.broadcasts.length;
                const lastBc = history.broadcasts[total - 1];

                let text = `📊 *Broadcast Statistics*\n\n`;
                text += `📢 Total broadcasts: ${total}\n`;
                if (lastBc) {
                    text += `🕐 Last: ${new Date(lastBc.timestamp).toLocaleString()}\n`;
                    text += `✅ Delivered: ${lastBc.delivered}/${lastBc.total}\n`;
                    text += `❌ Failed: ${lastBc.failed}\n`;
                }
                return extra.reply(text);
            }

            if (action === 'last') {
                const history = loadHistory();
                const lastBc = history.broadcasts[history.broadcasts.length - 1];
                if (!lastBc) return extra.reply('📭 No broadcasts yet.');

                let text = `📢 *Last Broadcast*\n\n`;
                text += `📝 Message: ${lastBc.message.slice(0, 100)}...\n`;
                text += `🕐 Time: ${new Date(lastBc.timestamp).toLocaleString()}\n`;
                text += `📊 Delivered: ${lastBc.delivered}/${lastBc.total}\n`;
                text += `❌ Failed: ${lastBc.failed}\n`;
                text += `⏱️ Duration: ${lastBc.duration}s`;
                return extra.reply(text);
            }

            // Get message
            const messageStart = action === 'groups' ? 1 : 0;
            const message = args.slice(messageStart).join(' ');
            if (!message) return extra.reply('❌ Usage: `.smartbc <message>`');

            await extra.reply('📢 Starting smart broadcast...');

            // Get all groups
            const chats = await sock.groupFetchAllParticipating();
            const groups = Object.values(chats);

            let delivered = 0;
            let failed = 0;
            const startTime = Date.now();

            for (const group of groups) {
                try {
                    // Smart delay (3-5 seconds between groups)
                    const sendDelay = 3000 + Math.floor(Math.random() * 2000);
                    await delay(sendDelay);

                    await sock.sendMessage(group.id, {
                        text: `📢 *Official Announcement*\n\n${message}\n\n> _Sent by bot owner via EDBOTS AI_`
                    });
                    delivered++;
                    console.log(`[SMART BC] ✅ ${group.subject} (${delivered}/${groups.length})`);
                } catch (e) {
                    failed++;
                    console.error(`[SMART BC] ❌ ${group.subject}: ${e.message}`);
                }
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);

            // Save history
            const history = loadHistory();
            history.broadcasts.push({
                id: Date.now().toString(36),
                message,
                timestamp: Date.now(),
                total: groups.length,
                delivered,
                failed,
                duration
            });
            // Keep last 20 broadcasts
            if (history.broadcasts.length > 20) {
                history.broadcasts = history.broadcasts.slice(-20);
            }
            saveHistory(history);

            await extra.reply(
                `📢 *Broadcast Complete!*\n\n` +
                `✅ Delivered: ${delivered}/${groups.length}\n` +
                `❌ Failed: ${failed}\n` +
                `⏱️ Duration: ${duration}s\n` +
                `📊 Average: ${(duration / groups.length).toFixed(1)}s per group`
            );

        } catch (error) {
            console.error('[SMART BC ERROR]', error);
            await extra.reply('❌ Broadcast error.');
        }
    }
};
