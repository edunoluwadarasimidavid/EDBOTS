/**
 * @file antiBan.js
 * @description High-Grade Anti-Ban System for EDBOTS.
 * Human-like behavior simulation with no external API calls.
 */

const config = require('../config');
const botState = require('../core/botState');

// Dynamic delay that mimics human typing patterns
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class HighGradeAntiBan {
    constructor() {
        this.userState = new Map(); // JID -> { lastMessageTime, messageCount, lastResponseTime }
        this.globalLastMessageTime = 0;
        this.totalMessagesSent = 0;
        // Cleanup stale entries every 5 minutes
        setInterval(() => this.cleanupStaleEntries(), 5 * 60 * 1000);
    }

    /**
     * Remove entries that haven't been active in 2 minutes
     */
    cleanupStaleEntries() {
        const now = Date.now();
        const STALE_THRESHOLD = 2 * 60 * 1000;
        for (const [jid, state] of this.userState) {
            if (now - state.lastMessageTime > STALE_THRESHOLD) {
                this.userState.delete(jid);
            }
        }
    }

    /**
     * Standard Anti-Ban shouldRespond check
     * No external API calls - purely local rate limiting
     */
    async shouldRespond(sock, jid, isCmd = false, isPrivileged = false) {
        const now = Date.now();
        const state = this.userState.get(jid) || {
            lastMessageTime: 0,
            messageCount: 0,
            lastResponseTime: 0
        };

        // Reset user count if they haven't messaged in 60 seconds
        if (now - state.lastMessageTime > 60000) {
            state.messageCount = 0;
        }

        // Tiered Rate Limiting based on privilege
        let limit = 20; // Free users: 20 messages/minute
        if (isPrivileged === 'owner') limit = 100;
        else if (isPrivileged) limit = 50;

        if (state.messageCount >= limit) {
            console.warn(`[ANTI-BAN] Rate limit hit for ${jid} (${state.messageCount}/${limit})`);
            return false;
        }

        // Command cooldown - prevent rapid command firing
        // Owner: 800ms, Admin: 1200ms, User: 2500ms
        const cooldown = isPrivileged === 'owner' ? 800
            : isPrivileged ? 1200
            : 2500;

        if (isCmd && now - state.lastResponseTime < cooldown) {
            return false;
        }

        state.messageCount++;
        state.lastMessageTime = now;
        this.userState.set(jid, state);

        return true;
    }

    /**
     * Simulate human typing behavior.
     * Uses WPM-based calculation so typing time matches message length naturally.
     * Short messages get short delays; long messages get proportionally longer ones.
     */
    async simulateHumanBehavior(sock, jid, responseText = '') {
        try {
            // CONNECTION-AWARE: never touch a socket that is not genuinely
            // open. This is the fix for the repeating
            // "[ANTI-BAN] Presence update error: Connection Closed" spam:
            // those errors fired while the bot was down/reconnecting.
            if (!botState.isSocketOpen(sock)) {
                console.warn('[ANTI-BAN] Presence update skipped — socket is not open.');
                return;
            }

            const charCount = (responseText || '').length || 20;

            // Simulate human typing speed: ~60-120 WPM → ~3-6 chars/sec
            // Average ~4.5 chars/sec = ~222ms per character
            // But we cap it: min 1s, max 5s for very long messages
            const avgCharsPerMs = 0.004; // ~250 chars per second typing speed
            const typingDuration = Math.min(Math.max(1000, charCount / avgCharsPerMs * 0.3), 5000);

            // Add slight randomness to make it feel more natural (±15%)
            const jitter = typingDuration * (0.85 + Math.random() * 0.3);
            const finalDelay = Math.round(jitter);

            // Show "typing..." while composing
            await sock.sendPresenceUpdate('composing', jid);
            await delay(finalDelay);

            // Re-check after the delay: the connection may have dropped
            // mid-typing (the exact window where the old code errored).
            if (!botState.isSocketOpen(sock)) {
                console.warn('[ANTI-BAN] Presence update aborted mid-typing — socket closed.');
                return;
            }
            await sock.sendPresenceUpdate('paused', jid);

            // Update last response time
            const state = this.userState.get(jid) || {
                lastMessageTime: 0,
                messageCount: 0,
                lastResponseTime: 0
            };
            state.lastResponseTime = Date.now();
            this.userState.set(jid, state);
        } catch (err) {
            // Non-critical: don't crash if presence update fails
            console.error('[ANTI-BAN] Presence update error:', err.message);
        }
    }
}

module.exports = new HighGradeAntiBan();
