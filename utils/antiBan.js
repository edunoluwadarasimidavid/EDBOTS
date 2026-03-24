/**
 * @file antiBan.js
 * @description High-Grade Anti-Ban System for EDBOTS.
 * Implements human behavior simulation, account warming, and smart rate limiting.
 */

const config = require('../config');
const { randomDelay, delay } = require('../src/utils/delay');

class HighGradeAntiBan {
    constructor() {
        this.userState = new Map(); // JID -> { lastMessageTime, messageCount, lastResponseTime }
        this.globalLastMessageTime = 0;
        this.isWarmingUp = false;
        this.sessionStartTime = Date.now();
        this.totalMessagesSent = 0;
    }

    /**
     * Determines if the bot should respond to a message.
     * Implements strict rate limiting and spam protection.
     */
    async shouldRespond(jid, isCmd = false) {
        const now = Date.now();
        const state = this.userState.get(jid) || { lastMessageTime: 0, messageCount: 0, lastResponseTime: 0 };

        // 1. Reset user count if they haven't messaged in 1 minute
        if (now - state.lastMessageTime > 60000) {
            state.messageCount = 0;
        }

        // 2. User-level rate limit: Max 5 messages per minute
        if (state.messageCount >= 5) {
            console.warn(`[ANTI-BAN] Rate limit hit for ${jid}. Ignoring.`);
            return false;
        }

        // 3. Command-specific cooldown
        if (isCmd && now - state.lastResponseTime < 3000) {
            return false;
        }

        state.messageCount++;
        state.lastMessageTime = now;
        this.userState.set(jid, state);
        return true;
    }

    /**
     * Simulates human-like behavior based on response length and session state.
     */
    async simulateHumanBehavior(sock, jid, responseText = "") {
        const now = Date.now();
        
        // 1. Account Warming Logic: 
        // If the bot hasn't sent a message in over 6 hours, it "wakes up" slowly.
        const timeSinceLastGlobalMsg = now - this.globalLastMessageTime;
        const SIX_HOURS = 6 * 60 * 60 * 1000;
        
        if (timeSinceLastGlobalMsg > SIX_HOURS && this.globalLastMessageTime !== 0) {
            console.log(`[ANTI-BAN] Account warming triggered after ${Math.round(timeSinceLastGlobalMsg/3600000)}h inactivity.`);
            await delay(randomDelay(3000, 7000)); // Extra "wake up" delay
        }

        // 2. Presence Updates
        if (sock.presenceObserve) {
            await sock.presenceObserve(jid).catch(() => {});
        }
        await delay(randomDelay(500, 1500));
        
        // 3. Dynamic Typing Simulation:
        // Humans type at roughly 40-60 words per minute.
        // We simulate typing speed based on the length of the response.
        const charCount = responseText.length || 20;
        const baseTypingMs = Math.min(charCount * 50, 5000); // Max 5 seconds typing simulation
        const randomTypingMs = Math.floor(Math.random() * 2000) + 1000; // 1-3s random base
        const totalTypingMs = Math.max(2000, baseTypingMs + randomTypingMs);

        await sock.sendPresenceUpdate('composing', jid);
        await delay(totalTypingMs);
        await sock.sendPresenceUpdate('paused', jid);

        // 4. Update global state
        this.globalLastMessageTime = Date.now();
        this.totalMessagesSent++;
        
        // Update user specific last response time
        const state = this.userState.get(jid) || { lastMessageTime: 0, messageCount: 0, lastResponseTime: 0 };
        state.lastResponseTime = Date.now();
        this.userState.set(jid, state);
    }

    /**
     * Randomly simulate "Online" status during the day to look active,
     * but avoid being online 24/7.
     */
    async syncPresence(sock) {
        // Logic to occasionally set online status could go here
        // For now we rely on presenceObserve during message handling.
    }
}

const antiBanInstance = new HighGradeAntiBan();
module.exports = antiBanInstance;
