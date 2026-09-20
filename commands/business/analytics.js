/**
 * @file analytics.js
 * @description Business Analytics Dashboard for EDBOTS.
 * 
 * Commands:
 *   .analytics        - View analytics dashboard
 *   .analytics today  - Today's stats
 *   .analytics week   - Weekly report
 *   .analytics contacts - Top contacts
 *   .analytics export - Export analytics data
 */

const fs = require('fs');
const path = require('path');

const ANALYTICS_FILE = path.join(__dirname, '../../data/analytics.json');

class AnalyticsDashboard {
    constructor() {
        this.data = this.load();
    }

    load() {
        try {
            const dir = path.dirname(ANALYTICS_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            if (!fs.existsSync(ANALYTICS_FILE)) {
                const defaults = {
                    messages: {},
                    contacts: {},
                    commands: {},
                    dailyStats: {},
                    weeklyStats: {},
                    sentiment: { positive: 0, negative: 0, neutral: 0 },
                    peakHours: new Array(24).fill(0),
                    totalMessages: 0,
                    totalContacts: new Set()
                };
                fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(defaults, null, 2));
                return defaults;
            }
            const data = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
            // Convert totalContacts back to Set if it's an array
            if (Array.isArray(data.totalContacts)) {
                data.totalContacts = new Set(data.totalContacts);
            } else {
                data.totalContacts = new Set();
            }
            return data;
        } catch (e) {
            return { messages: {}, contacts: {}, commands: {}, dailyStats: {}, weeklyStats: {}, sentiment: { positive: 0, negative: 0, neutral: 0 }, peakHours: new Array(24).fill(0), totalMessages: 0, totalContacts: new Set() };
        }
    }

    save() {
        try {
            const dir = path.dirname(ANALYTICS_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            // Convert Set to array for JSON
            const dataToSave = {
                ...this.data,
                totalContacts: Array.from(this.data.totalContacts || [])
            };
            fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(dataToSave, null, 2));
        } catch (e) {
            console.error('[Analytics] Save error:', e);
        }
    }

    trackMessage(chatId, userId, isCommand = false, commandName = null) {
        const today = new Date().toISOString().split('T')[0];
        const hour = new Date().getHours();

        // Total messages
        this.data.totalMessages = (this.data.totalMessages || 0) + 1;

        // Daily messages
        if (!this.data.dailyStats[today]) {
            this.data.dailyStats[today] = { messages: 0, commands: 0, uniqueUsers: new Set() };
        }
        this.data.dailyStats[today].messages++;
        if (isCommand) this.data.dailyStats[today].commands++;
        this.data.dailyStats[today].uniqueUsers.add(userId);

        // Peak hours
        this.data.peakHours[hour] = (this.data.peakHours[hour] || 0) + 1;

        // Contacts
        if (!this.data.contacts[userId]) {
            this.data.contacts[userId] = { messages: 0, firstSeen: today, lastSeen: today };
            this.data.totalContacts.add(userId);
        }
        this.data.contacts[userId].messages++;
        this.data.contacts[userId].lastSeen = today;

        // Commands
        if (commandName) {
            this.data.commands[commandName] = (this.data.commands[commandName] || 0) + 1;
        }

        this.save();
    }

    getDashboard() {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Today's stats
        const todayStats = this.data.dailyStats[today] || { messages: 0, commands: 0, uniqueUsers: new Set() };

        // Weekly stats
        let weekMessages = 0;
        let weekCommands = 0;
        let weekUsers = new Set();
        Object.entries(this.data.dailyStats).forEach(([date, stats]) => {
            if (date >= weekAgo) {
                weekMessages += stats.messages || 0;
                weekCommands += stats.commands || 0;
                if (stats.uniqueUsers) {
                    (Array.isArray(stats.uniqueUsers) ? stats.uniqueUsers : []).forEach(u => weekUsers.add(u));
                }
            }
        });

        // Top commands
        const topCommands = Object.entries(this.data.commands)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Top contacts
        const topContacts = Object.entries(this.data.contacts)
            .sort((a, b) => b[1].messages - a[1].messages)
            .slice(0, 5);

        // Peak hours
        const peakHour = this.data.peakHours.indexOf(Math.max(...this.data.peakHours));

        // Sentiment
        const totalSentiment = this.data.sentiment.positive + this.data.sentiment.negative + this.data.sentiment.neutral;

        return {
            today: {
                messages: todayStats.messages || 0,
                commands: todayStats.commands || 0,
                uniqueUsers: todayStats.uniqueUsers?.size || 0
            },
            week: {
                messages: weekMessages,
                commands: weekCommands,
                uniqueUsers: weekUsers.size
            },
            total: {
                messages: this.data.totalMessages || 0,
                contacts: this.data.totalContacts?.size || 0
            },
            topCommands,
            topContacts,
            peakHour,
            sentiment: this.data.sentiment,
            sentimentTotal: totalSentiment
        };
    }

    getTodayReport() {
        const today = new Date().toISOString().split('T')[0];
        const stats = this.data.dailyStats[today] || { messages: 0, commands: 0, uniqueUsers: new Set() };

        let text = `📊 *Today's Report*\n\n`;
        text += `📅 Date: ${today}\n`;
        text += `📨 Messages: ${stats.messages || 0}\n`;
        text += `⚡ Commands: ${stats.commands || 0}\n`;
        text += `👥 Active Users: ${stats.uniqueUsers?.size || 0}\n`;

        return text;
    }

    getWeeklyReport() {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const stats = this.data.dailyStats[date] || { messages: 0 };
            days.push({ date, messages: stats.messages || 0 });
        }

        let text = `📊 *Weekly Report*\n\n`;
        text += `┌─────────┬──────────┐\n`;
        text += `│ Day     │ Messages │\n`;
        text += `├─────────┼──────────┤\n`;
        
        let total = 0;
        days.forEach(d => {
            const dayName = new Date(d.date).toLocaleDateString('en', { weekday: 'short' });
            const bar = '█'.repeat(Math.min(Math.round(d.messages / 5), 10));
            text += `│ ${dayName.padEnd(7)} │ ${(d.messages + '').padStart(8)} │\n`;
            total += d.messages;
        });
        
        text += `├─────────┼──────────┤\n`;
        text += `│ Total   │ ${(total + '').padStart(8)} │\n`;
        text += `└─────────┴──────────┘\n`;

        return text;
    }

    reset() {
        this.data = {
            messages: {},
            contacts: {},
            commands: {},
            dailyStats: {},
            weeklyStats: {},
            sentiment: { positive: 0, negative: 0, neutral: 0 },
            peakHours: new Array(24).fill(0),
            totalMessages: 0,
            totalContacts: new Set()
        };
        this.save();
    }
}

const analyticsDashboard = new AnalyticsDashboard();

module.exports = {
    name: 'analytics',
    aliases: ['stats', 'dashboard', 'report'],
    category: 'business',
    description: 'View business analytics dashboard',
    usage: '.analytics [today/week/contacts/export]',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            const action = args[0]?.toLowerCase();

            switch (action) {
                case 'today': {
                    return extra.reply(analyticsDashboard.getTodayReport());
                }

                case 'week':
                case 'weekly': {
                    return extra.reply(analyticsDashboard.getWeeklyReport());
                }

                case 'reset': {
                    if (!extra.isOwner) {
                        return extra.reply('❌ Only the bot owner can reset analytics.');
                    }
                    analyticsDashboard.reset();
                    return extra.reply('✅ Analytics data has been reset.');
                }

                default: {
                    const dashboard = analyticsDashboard.getDashboard();

                    let text = `📊 *Analytics Dashboard*\n\n`;
                    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
                    text += `*📅 Today:*\n`;
                    text += `• Messages: ${dashboard.today.messages}\n`;
                    text += `• Commands: ${dashboard.today.commands}\n`;
                    text += `• Active Users: ${dashboard.today.uniqueUsers}\n\n`;

                    text += `*📆 This Week:*\n`;
                    text += `• Messages: ${dashboard.week.messages}\n`;
                    text += `• Commands: ${dashboard.week.commands}\n`;
                    text += `• Unique Users: ${dashboard.week.uniqueUsers}\n\n`;

                    text += `*📈 All Time:*\n`;
                    text += `• Total Messages: ${dashboard.total.messages}\n`;
                    text += `• Total Contacts: ${dashboard.total.contacts}\n`;
                    text += `• Peak Hour: ${dashboard.peakHour}:00\n\n`;

                    if (dashboard.topCommands.length > 0) {
                        text += `*🔥 Top Commands:*\n`;
                        dashboard.topCommands.forEach(([cmd, count], i) => {
                            text += `${i + 1}. ${cmd} (${count}x)\n`;
                        });
                        text += '\n';
                    }

                    if (dashboard.topContacts.length > 0) {
                        text += `*👤 Top Contacts:*\n`;
                        dashboard.topContacts.forEach(([userId, data], i) => {
                            text += `${i + 1}. @${userId.split('@')[0]} (${data.messages} msgs)\n`;
                        });
                    }

                    text += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
                    text += `> _Use \`.analytics today\` or \`.analytics week\` for detailed reports_`;

                    return extra.reply(text);
                }
            }
        } catch (error) {
            console.error('[ANALYTICS ERROR]', error);
            await extra.reply('❌ Error loading analytics.');
        }
    }
};

// Export for use in handler
module.exports.analyticsDashboard = analyticsDashboard;
