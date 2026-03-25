/**
 * @file antiBan.js
 * @description High-Grade Anti-Ban System for EDBOTS.
 * Implements tiered rate limiting and human behavior simulation.
 */

const config = require('../config');
const { randomDelay, delay } = require('../src/utils/delay');

class HighGradeAntiBan {
    constructor() {
        this.userState = new Map(); // JID -> { lastMessageTime, messageCount, lastResponseTime }
        this.globalLastMessageTime = 0;
        this.sessionStartTime = Date.now();
        this.totalMessagesSent = 0;
    }

    /**
     * Determines if the bot should respond to a message.
     * Tiered limits:
     * - Privileged (Owner/Admin): 40 msgs/min (High safety)
     * - Regular Users: 20 msgs/min (Standard safety)
     */
    async shouldRespond(jid, isCmd = false, isPrivileged = false) {
        const now = Date.now();
        const state = this.userState.get(jid) || { lastMessageTime: 0, messageCount: 0, lastResponseTime: 0 };

        // 1. Reset user count if they haven't messaged in 1 minute
        if (now - state.lastMessageTime > 60000) {
            state.messageCount = 0;
        }

        // 2. Tiered Rate Limiting
        const limit = isPrivileged ? 40 : 20;

        if (state.messageCount >= limit) {
            console.warn(`[ANTI-BAN] Rate limit hit for ${jid} (${isPrivileged ? 'Privileged' : 'Regular'}). Ignoring.`);
            return false;
        }

        // 3. Command-specific cooldown: 1.2s for privileged, 2s for others
        const cooldown = isPrivileged ? 1200 : 2000;
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
