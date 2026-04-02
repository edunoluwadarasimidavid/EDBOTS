/**
 * @file antiBan.js
 * @description High-Grade Anti-Ban System for EDBOTS.
 * Implements tiered rate limiting and human behavior simulation.
 */

const axios = require('axios');
const config = require('../config');
const { randomDelay, delay } = require('../src/utils/delay');
const { BACKEND_BASE_URL } = require('../config/backendUrl');

class HighGradeAntiBan {
    constructor() {
        this.userState = new Map(); // JID -> { lastMessageTime, messageCount, lastResponseTime, isPremium, lastPremiumCheck }
        this.globalLastMessageTime = 0;
        this.sessionStartTime = Date.now();
        this.totalMessagesSent = 0;
    }

    /**
     * Checks premium status from backend (with local caching for 5 mins)
     */
    async checkPremium(jid) {
        const userId = jid.split('@')[0];
        const state = this.userState.get(jid) || {};
        const now = Date.now();

        // Use cache if checked in the last 5 minutes
        if (state.lastPremiumCheck && (now - state.lastPremiumCheck < 300000)) {
            return state.isPremium;
        }

        try {
            const res = await axios.get(`${BACKEND_BASE_URL}/api/premium/status?userId=${userId}`, { timeout: 2000 });
            const isPremium = !!res.data.isPremium;
            state.isPremium = isPremium;
            state.lastPremiumCheck = now;
            this.userState.set(jid, state);
            return isPremium;
        } catch (e) {
            // If backend is down, default to false (safe mode)
            return state.isPremium || false;
        }
    }

    /**
     * Determines if the bot should respond to a message.
     * Tiered limits:
     * - Premium/Owner: 80 msgs/min (Unlock peak safety)
     * - Privileged (Admin): 40 msgs/min (High safety)
     * - Regular Users: 20 msgs/min (Standard safety)
     */
    async shouldRespond(jid, isCmd = false, isPrivileged = false) {
        const now = Date.now();
        const state = this.userState.get(jid) || { lastMessageTime: 0, messageCount: 0, lastResponseTime: 0 };
        
        const isPremium = await this.checkPremium(jid);

        // 1. Reset user count if they haven't messaged in 1 minute
        if (now - state.lastMessageTime > 60000) {
            state.messageCount = 0;
        }

        // 2. Tiered Rate Limiting
        let limit = 20; // Default
        if (isPremium || isPrivileged === 'owner') limit = 80;
        else if (isPrivileged) limit = 40;

        if (state.messageCount >= limit) {
            console.warn(`[ANTI-BAN] Rate limit hit for ${jid} (${isPremium ? 'Premium' : isPrivileged ? 'Admin' : 'Regular'}). Ignoring.`);
            return false;
        }

        // 3. Command-specific cooldown
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
     * Simulates human-like behavior.
     */
    async simulateHumanBehavior(sock, jid, responseText = "") {
        const now = Date.now();
        
        // 1. Account Warming Logic
        const timeSinceLastGlobalMsg = now - this.globalLastMessageTime;
        const SIX_HOURS = 6 * 60 * 60 * 1000;
        
        if (timeSinceLastGlobalMsg > SIX_HOURS && this.globalLastMessageTime !== 0) {
            await delay(randomDelay(2000, 4000));
        }

        // 2. Presence Updates
        if (sock.presenceObserve) {
            await sock.presenceObserve(jid).catch(() => {});
        }
        await delay(randomDelay(300, 800));
        
        // 3. Dynamic Typing Simulation
        const charCount = responseText.length || 20;
        const baseTypingMs = Math.min(charCount * 30, 4000); 
        const randomTypingMs = Math.floor(Math.random() * 800) + 400; 
        const totalTypingMs = Math.max(1000, baseTypingMs + randomTypingMs);

        await sock.sendPresenceUpdate('composing', jid);
        await delay(totalTypingMs);
        await sock.sendPresenceUpdate('paused', jid);

        // 4. Update state
        this.globalLastMessageTime = Date.now();
        this.totalMessagesSent++;
        
        const state = this.userState.get(jid) || { lastMessageTime: 0, messageCount: 0, lastResponseTime: 0 };
        state.lastResponseTime = Date.now();
        this.userState.set(jid, state);
    }
}

const antiBanInstance = new HighGradeAntiBan();
module.exports = antiBanInstance;
