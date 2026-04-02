/**
 * @file antiBan.js
 * @description High-Grade Anti-Ban System for EDBOTS with Premium Usage Tracking.
 */

const axios = require('axios');
const config = require('../config');
const { randomDelay, delay } = require('../src/utils/delay');
const { BACKEND_BASE_URL } = require('../config/backendUrl');
const moment = require('moment-timezone');

class HighGradeAntiBan {
    constructor() {
        this.userState = new Map(); // JID -> { lastMessageTime, messageCount, lastResponseTime, isPremium, lastPremiumCheck }
        this.globalLastMessageTime = 0;
        this.totalMessagesSent = 0;
    }

    /**
     * Checks premium status & usage from backend
     * Triggers notifications for activation and limit exhaustion
     */
    async checkPremiumAndUsage(sock, jid, isCommand = false) {
        const userId = jid.split('@')[0];
        const state = this.userState.get(jid) || {};
        const now = Date.now();

        // Increment usage only if it's a command
        const increment = isCommand ? 'true' : 'false';

        try {
            const res = await axios.get(`${BACKEND_BASE_URL}/api/premium/status?userId=${userId}&increment=${increment}`, { timeout: 3000 });
            const data = res.data;

            // 1. Handle Activation Notification (Only once per purchase)
            if (data.activationNotify) {
                const expiry = moment(data.activationNotify.expiresAt).format('LLLL');
                await sock.sendMessage(jid, { 
                    text: `✅ *Premium Activated Successfully!*\n\n` +
                          `💎 *Plan:* ${data.activationNotify.plan.toUpperCase()}\n` +
                          `🗓️ *Expires:* ${expiry}\n\n` +
                          `Thank you for supporting EDBOTS! 🚀`
                });
            }

            // 2. Handle Limit Exhaustion Notification
            if (isCommand && data.isExhausted) {
                await sock.sendMessage(jid, {
                    text: `❌ *Usage Limit Reached*\n\n` +
                          `Your ${data.plan} daily limit has been exhausted.\n\n` +
                          `Upgrade to premium to continue using advanced features.\n` +
                          `Use *.premium* to view plans.`
                });
                return { allowed: false, ...data };
            }

            // Sync local cache
            state.isPremium = data.isPremium;
            state.lastPremiumCheck = now;
            this.userState.set(jid, state);

            return { allowed: true, ...data };
        } catch (e) {
            console.error('[ANTI-BAN] Backend Check Failed:', e.message);
            return { allowed: true, isPremium: state.isPremium || false, plan: 'free' };
        }
    }

    /**
     * Standard Anti-Ban shouldRespond check
     */
    async shouldRespond(sock, jid, isCmd = false, isPrivileged = false) {
        const now = Date.now();
        const state = this.userState.get(jid) || { lastMessageTime: 0, messageCount: 0, lastResponseTime: 0 };
        
        // Premium and Usage Sync
        const usage = await this.checkPremiumAndUsage(sock, jid, isCmd);
        if (!usage.allowed) return false;

        const isPremium = usage.isPremium;

        // Reset user count if they haven't messaged in 1 minute
        if (now - state.lastMessageTime > 60000) {
            state.messageCount = 0;
        }

        // Tiered Rate Limiting
        let limit = 20; 
        if (isPremium || isPrivileged === 'owner') limit = 80;
        else if (isPrivileged) limit = 40;

        if (state.messageCount >= limit) {
            console.warn(`[ANTI-BAN] Rate limit hit for ${jid}`);
            return false;
        }

        // Command cooldown
        const cooldown = (isPremium || isPrivileged === 'owner') ? 800 : isPrivileged ? 1200 : 2000;
        if (isCmd && now - state.lastResponseTime < cooldown) {
            return false;
        }

        state.messageCount++;
        state.lastMessageTime = now;
        this.userState.set(jid, state);
        return true;
    }

    /**
     * Simulate Typing...
     */
    async simulateHumanBehavior(sock, jid, responseText = "") {
        const charCount = responseText.length || 20;
        const totalTypingMs = Math.min(Math.max(1000, charCount * 30), 4000);

        await sock.sendPresenceUpdate('composing', jid);
        await delay(totalTypingMs);
        await sock.sendPresenceUpdate('paused', jid);
        
        const state = this.userState.get(jid) || { lastMessageTime: 0, messageCount: 0, lastResponseTime: 0 };
        state.lastResponseTime = Date.now();
        this.userState.set(jid, state);
    }
}

module.exports = new HighGradeAntiBan();
