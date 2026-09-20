/**
 * @file notifications.js
 * @description Notification & Alert Management Command.
 * 
 * Commands:
 *   .notify add <type> <params> - Create alert
 *   .notify list - View all alerts
 *   .notify delete <id> - Delete alert
 *   .notify toggle <id> - Toggle alert
 *   .notify dnd on/off - Do Not Disturb
 *   .notify schedule <time> <message> - Schedule notification
 *   .notify stats - View notification stats
 */

const notifications = require('../../utils/notifications');

module.exports = {
    name: 'notify',
    aliases: ['notifications', 'alerts', 'remindme'],
    category: 'owner',
    description: 'Manage notifications and alerts',
    usage: '.notify <add/list/delete/toggle/dnd/schedule/stats>',
    ownerOnly: true,
    visibility: 'private',

    async execute(sock, msg, args, extra) {
        try {
            const action = args[0]?.toLowerCase();

            switch (action) {
                case 'add':
                case 'create': {
                    const type = args[1]?.toLowerCase();
                    if (!type || !['keyword', 'mention', 'count', 'schedule'].includes(type)) {
                        return extra.reply(
                            `🔔 *Add Alert*\n\n` +
                            `*Types:*\n` +
                            `• \`keyword\` - Alert when specific words appear\n` +
                            `• \`mention\` - Alert when bot is mentioned\n` +
                            `• \`count\` - Alert after X messages\n` +
                            `• \`schedule\` - Scheduled alert\n\n` +
                            `*Usage:*\n` +
                            `• \`.notify add keyword <word1> <word2>...\`\n` +
                            `• \`.notify add mention\`\n` +
                            `• \`.notify add count <number>\``
                        );
                    }

                    const alertOptions = {
                        type,
                        keywords: args.slice(2),
                        threshold: parseInt(args[2]) || 0,
                        message: `Alert: ${type} triggered!`
                    };

                    const alert = notifications.createAlert(extra.sender, alertOptions);
                    return extra.reply(`✅ *Alert Created!*\n\nID: ${alert.id}\nType: ${alert.type}\nKeywords: ${alert.keywords?.join(', ') || 'N/A'}`);
                }

                case 'list':
                case 'ls': {
                    const alerts = notifications.getAlerts(extra.sender);
                    if (alerts.length === 0) {
                        return extra.reply('📭 No alerts configured.\n\nUse \`.notify add\` to create one.');
                    }

                    let text = `🔔 *Your Alerts (${alerts.length})*\n\n`;
                    alerts.forEach((alert, i) => {
                        const status = alert.enabled ? '✅' : '❌';
                        text += `${status} ${alert.id} - ${alert.type}\n`;
                        if (alert.keywords?.length) text += `   Keywords: ${alert.keywords.join(', ')}\n`;
                        text += `   Triggered: ${alert.triggeredCount}x\n\n`;
                    });
                    return extra.reply(text);
                }

                case 'delete':
                case 'rm':
                case 'remove': {
                    const alertId = args[1];
                    if (!alertId) return extra.reply('❌ Usage: `.notify delete <alert-id>`');
                    
                    if (notifications.deleteAlert(extra.sender, alertId)) {
                        return extra.reply(`✅ Alert ${alertId} deleted.`);
                    }
                    return extra.reply(`❌ Alert ${alertId} not found.`);
                }

                case 'toggle': {
                    const alertId = args[1];
                    if (!alertId) return extra.reply('❌ Usage: `.notify toggle <alert-id>`');
                    
                    const result = notifications.toggleAlert(extra.sender, alertId);
                    if (result) {
                        return extra.reply(`✅ Alert ${alertId} ${result.enabled ? 'enabled' : 'disabled'}.`);
                    }
                    return extra.reply(`❌ Alert ${alertId} not found.`);
                }

                case 'dnd':
                case 'donotdisturb': {
                    const toggle = args[1]?.toLowerCase();
                    if (toggle === 'on') {
                        notifications.setDND(extra.sender, true);
                        return extra.reply('✅ Do Not Disturb *enabled*.');
                    }
                    if (toggle === 'off') {
                        notifications.setDND(extra.sender, false);
                        return extra.reply('✅ Do Not Disturb *disabled*.');
                    }
                    return extra.reply(
                        `🔕 *Do Not Disturb*\n\n` +
                        `*Usage:*\n` +
                        `• \`.notify dnd on\` - Enable DND\n` +
                        `• \`.notify dnd off\` - Disable DND`
                    );
                }

                case 'schedule': {
                    const timeStr = args[1];
                    const message = args.slice(2).join(' ');
                    
                    if (!timeStr || !message) {
                        return extra.reply(
                            `📅 *Schedule Notification*\n\n` +
                            `*Usage:* \`.notify schedule 09:00 Good morning reminder\`\n` +
                            `*Or:* \`.notify schedule 2024-12-25T10:00:00 Christmas alert\``
                        );
                    }

                    let time;
                    if (timeStr.includes('T')) {
                        time = new Date(timeStr);
                    } else {
                        const [hour, minute] = timeStr.split(':').map(Number);
                        time = { hour, minute };
                    }

                    const notification = notifications.scheduleNotification(extra.sender, {
                        time,
                        message
                    });

                    return extra.reply(`✅ *Notification Scheduled!*\n\nTime: ${timeStr}\nMessage: ${message}`);
                }

                case 'stats': {
                    const stats = notifications.getStats(extra.sender);
                    return extra.reply(
                        `📊 *Notification Stats*\n\n` +
                        `• Total Alerts: ${stats.totalAlerts}\n` +
                        `• Active Alerts: ${stats.activeAlerts}\n` +
                        `• Scheduled: ${stats.pendingScheduled}\n` +
                        `• DND: ${stats.dndEnabled ? '✅ ON' : '❌ OFF'}`
                    );
                }

                default:
                    return extra.reply(
                        `🔔 *Notification System*\n\n` +
                        `*Commands:*\n` +
                        `• \`.notify add <type> <params>\` - Create alert\n` +
                        `• \`.notify list\` - View all alerts\n` +
                        `• \`.notify delete <id>\` - Delete alert\n` +
                        `• \`.notify toggle <id>\` - Toggle alert\n` +
                        `• \`.notify dnd on/off\` - Do Not Disturb\n` +
                        `• \`.notify schedule <time> <msg>\` - Schedule\n` +
                        `• \`.notify stats\` - View stats`
                    );
            }
        } catch (error) {
            console.error('[NOTIFY ERROR]', error);
            await extra.reply('❌ Error with notifications.');
        }
    }
};
