/**
 * @file notifications.js
 * @description Smart Notification & Alert System for EDBOTS.
 * 
 * Features:
 * - Custom alerts (new messages, mentions, keywords)
 * - Scheduled reminders
 * - Threshold alerts (message count, response time)
 * - Channel notifications (DM vs group)
 * - Do Not Disturb mode
 * - Priority levels (low, medium, high, urgent)
 */

const fs = require('fs');
const path = require('path');

const NOTIFICATIONS_FILE = path.join(__dirname, '../data/notifications.json');

class NotificationSystem {
    constructor() {
        this.data = this.load();
        this.scheduledChecks = new Map();
        
        // Check scheduled notifications every minute
        setInterval(() => this.checkScheduled(), 60000);
    }

    load() {
        try {
            const dir = path.dirname(NOTIFICATIONS_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            if (!fs.existsSync(NOTIFICATIONS_FILE)) {
                const defaults = { alerts: {}, scheduled: [], dnd: {} };
                fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(defaults, null, 2));
                return defaults;
            }
            return JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf8'));
        } catch (e) {
            return { alerts: {}, scheduled: [], dnd: {} };
        }
    }

    save() {
        try {
            fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(this.data, null, 2));
        } catch (e) {
            console.error('[Notifications] Save error:', e);
        }
    }

    /**
     * Create an alert rule
     */
    createAlert(userId, options) {
        const {
            type = 'keyword', // keyword, message_count, response_time, schedule
            keywords = [],
            threshold = 0,
            schedule = null, // { time: '09:00', days: ['mon', 'tue'] }
            message = 'Alert triggered!',
            priority = 'medium',
            enabled = true
        } = options;

        if (!this.data.alerts[userId]) {
            this.data.alerts[userId] = [];
        }

        const alert = {
            id: Date.now().toString(36),
            type,
            keywords,
            threshold,
            schedule,
            message,
            priority,
            enabled,
            triggeredCount: 0,
            lastTriggered: null,
            createdAt: new Date().toISOString()
        };

        this.data.alerts[userId].push(alert);
        this.save();
        return alert;
    }

    /**
     * Check if a message triggers any alerts
     */
    checkAlerts(userId, message, context = {}) {
        const alerts = this.data.alerts[userId] || [];
        const triggered = [];

        for (const alert of alerts) {
            if (!alert.enabled) continue;

            // Check Do Not Disturb
            if (this.isDND(userId)) continue;

            let shouldTrigger = false;

            switch (alert.type) {
                case 'keyword':
                    // Case-sensitive keyword matching
                    shouldTrigger = alert.keywords.some(kw => message.includes(kw));
                    break;

                case 'message_count':
                    shouldTrigger = (context.messageCount || 0) >= alert.threshold;
                    break;

                case 'response_time':
                    shouldTrigger = (context.responseTime || 0) > alert.threshold;
                    break;

                case 'mention':
                    shouldTrigger = message.includes(`@${context.botNumber || ''}`);
                    break;
            }

            if (shouldTrigger) {
                alert.triggeredCount++;
                alert.lastTriggered = new Date().toISOString();
                triggered.push(alert);
            }
        }

        if (triggered.length > 0) this.save();
        return triggered;
    }

    /**
     * Schedule a one-time notification
     */
    scheduleNotification(userId, options) {
        const {
            time, // ISO timestamp or { hour: 9, minute: 0 }
            message,
            recurring = false,
            days = null // ['mon', 'tue', 'wed'] for recurring
        } = options;

        const notification = {
            id: Date.now().toString(36),
            userId,
            time,
            message,
            recurring,
            days,
            sent: false,
            createdAt: new Date().toISOString()
        };

        this.data.scheduled.push(notification);
        this.save();
        return notification;
    }

    /**
     * Check scheduled notifications
     */
    checkScheduled() {
        const now = new Date();
        const currentDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        for (const notification of this.data.scheduled) {
            if (notification.sent && !notification.recurring) continue;

            // Check if it's time
            let shouldSend = false;

            if (typeof notification.time === 'string') {
                // ISO timestamp
                const notifTime = new Date(notification.time);
                if (now >= notifTime && !notification.sent) {
                    shouldSend = true;
                }
            } else if (notification.time?.hour !== undefined) {
                // Recurring time
                const notifTime = `${notification.time.hour.toString().padStart(2, '0')}:${notification.time.minute.toString().padStart(2, '0')}`;
                if (currentTime === notifTime) {
                    if (!notification.days || notification.days.includes(currentDay)) {
                        shouldSend = true;
                    }
                }
            }

            if (shouldSend) {
                notification.sent = true;
                this.sendNotification(notification);
            }
        }

        // Clean up old one-time notifications
        this.data.scheduled = this.data.scheduled.filter(n => n.recurring || !n.sent);
        this.save();
    }

    /**
     * Send notification (placeholder - would use sock.sendMessage)
     */
    sendNotification(notification) {
        console.log(`[Notification] Sending to ${notification.userId}: ${notification.message}`);
        // In production, this would use the socket to send the message
        // This is called from the checkScheduled loop
    }

    /**
     * Set Do Not Disturb
     */
    setDND(userId, enabled, startTime = null, endTime = null) {
        this.data.dnd[userId] = {
            enabled,
            startTime,
            endTime
        };
        this.save();
    }

    /**
     * Check if user is in DND mode
     */
    isDND(userId) {
        const dnd = this.data.dnd[userId];
        if (!dnd || !dnd.enabled) return false;

        if (dnd.startTime && dnd.endTime) {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const start = this.timeToMinutes(dnd.startTime);
            const end = this.timeToMinutes(dnd.endTime);

            if (start <= end) {
                return currentMinutes >= start && currentMinutes <= end;
            } else {
                return currentMinutes >= start || currentMinutes <= end;
            }
        }

        return true;
    }

    /**
     * Get all alerts for a user
     */
    getAlerts(userId) {
        return this.data.alerts[userId] || [];
    }

    /**
     * Delete an alert
     */
    deleteAlert(userId, alertId) {
        if (!this.data.alerts[userId]) return false;
        const index = this.data.alerts[userId].findIndex(a => a.id === alertId);
        if (index === -1) return false;
        this.data.alerts[userId].splice(index, 1);
        this.save();
        return true;
    }

    /**
     * Toggle alert enabled/disabled
     */
    toggleAlert(userId, alertId) {
        const alerts = this.data.alerts[userId] || [];
        const alert = alerts.find(a => a.id === alertId);
        if (!alert) return null;
        alert.enabled = !alert.enabled;
        this.save();
        return alert;
    }

    /**
     * Get notification stats
     */
    getStats(userId) {
        const alerts = this.data.alerts[userId] || [];
        const scheduled = this.data.scheduled.filter(n => n.userId === userId);
        const dnd = this.data.dnd[userId];

        return {
            totalAlerts: alerts.length,
            activeAlerts: alerts.filter(a => a.enabled).length,
            totalScheduled: scheduled.length,
            pendingScheduled: scheduled.filter(n => !n.sent).length,
            dndEnabled: dnd?.enabled || false
        };
    }

    /**
     * Time string to minutes helper
     */
    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }
}

module.exports = new NotificationSystem();
