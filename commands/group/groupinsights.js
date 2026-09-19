/**
 * Group Insights Command - Analytics and statistics for groups
 */

const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, '../../data/groupStats.json');

function loadStats() {
    try {
        if (!fs.existsSync(STATS_FILE)) return {};
        return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

module.exports = {
    name: 'insights',
    aliases: ['analytics', 'stats', 'groupstats'],
    category: 'admin',
    description: 'View group analytics and insights',
    usage: '.insights [period]',
    isAdmin: true,
    isGroup: true,

    async execute(sock, msg, args, extra) {
        try {
            const groupId = extra.from;
            const stats = loadStats();

            if (!stats[groupId]) {
                return extra.reply('📊 No data available yet. Messages will be tracked once the bot starts counting.');
            }

            const groupStats = stats[groupId];
            const period = args[0]?.toLowerCase() || 'today';

            // Get today's date
            const today = new Date().toISOString().slice(0, 10);
            const todayStats = groupStats[today] || { total: 0, users: {}, hours: {} };

            // Calculate weekly stats
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            let weekTotal = 0;
            let weekUsers = {};

            Object.entries(groupStats).forEach(([date, data]) => {
                if (new Date(date) >= weekAgo) {
                    weekTotal += data.total || 0;
                    Object.entries(data.users || {}).forEach(([user, count]) => {
                        weekUsers[user] = (weekUsers[user] || 0) + count;
                    });
                }
            });

            // Top chatters
            const topChatters = Object.entries(todayStats.users || {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            const weekTopChatters = Object.entries(weekUsers)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            // Peak hours
            const peakHours = Object.entries(todayStats.hours || {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

            let text = `📊 *Group Insights*\n\n`;

            if (period === 'today' || period === 'day') {
                text += `📅 *Today's Stats:*\n`;
                text += `• Total messages: *${todayStats.total}*\n`;
                text += `• Active users: *${Object.keys(todayStats.users || {}).length}*\n\n`;

                if (topChatters.length > 0) {
                    text += `🏆 *Top Chatters Today:*\n`;
                    topChatters.forEach(([user, count], i) => {
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
                        text += `${medal} @${user.split('@')[0]}: ${count} msgs\n`;
                    });
                    text += `\n`;
                }

                if (peakHours.length > 0) {
                    text += `⏰ *Peak Hours:*\n`;
                    peakHours.forEach(([hour, count]) => {
                        text += `• ${hour}:00 - ${count} messages\n`;
                    });
                }
            } else if (period === 'week') {
                text += `📅 *This Week's Stats:*\n`;
                text += `• Total messages: *${weekTotal}*\n`;
                text += `• Active users: *${Object.keys(weekUsers).length}*\n\n`;

                if (weekTopChatters.length > 0) {
                    text += `🏆 *Top Chatters This Week:*\n`;
                    weekTopChatters.forEach(([user, count], i) => {
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
                        text += `${medal} @${user.split('@')[0]}: ${count} msgs\n`;
                    });
                }
            }

            text += `\n> Use \`.insights week\` for weekly stats`;

            await sock.sendMessage(extra.from, {
                text,
                mentions: topChatters.map(([u]) => u).concat(weekTopChatters.map(([u]) => u))
            }, { quoted: msg });

        } catch (error) {
            console.error('[INSIGHTS ERROR]', error);
            await extra.reply('❌ Error fetching insights.');
        }
    }
};
