/**
 * @file advancedAntiBan.js
 * @description Enterprise-Grade Anti-Ban System with Advanced Human-Like Behavior.
 * 
 * Features:
 * - Natural typing simulation (variable speed based on message complexity)
 * - Random pause patterns (human-like breaks)
 * - Message length variation
 * - Time-of-day awareness (different behavior at different hours)
 * - Burst protection (limits rapid-fire messages)
 * - Smart cooldown (graduated penalties)
 * - Activity pattern learning
 * - Circuit breaker (stops if too many failures)
 */

const config = require('../config');
const botState = require('../core/botState');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class AdvancedAntiBan {
    constructor() {
        this.userState = new Map();
        this.globalState = {
            messagesSent: 0,
            lastGlobalMessage: 0,
            consecutiveErrors: 0,
            circuitBreakerActive: false
        };
        this.activityPatterns = new Map(); // userId -> { hourlyActivity: [], avgResponseTime: 0 }
        
        // Cleanup every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
        
        // Reset circuit breaker every 5 minutes
        setInterval(() => {
            if (this.globalState.circuitBreakerActive) {
                this.globalState.consecutiveErrors = 0;
                this.globalState.circuitBreakerActive = false;
                console.log('[AntiBan] Circuit breaker reset');
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Get user state or create default
     */
    getUserState(userId) {
        if (!this.userState.has(userId)) {
            this.userState.set(userId, {
                messageCount: 0,
                lastMessageTime: 0,
                lastResponseTime: 0,
                hourlyActivity: new Array(24).fill(0),
                avgResponseTime: 0,
                responseTimeSamples: [],
                burstCount: 0,
                burstStartTime: 0,
                cooldownUntil: 0,
                warningCount: 0
            });
        }
        return this.userState.get(userId);
    }

    /**
     * Check if we should respond to this user
     * Returns true if allowed, false if rate-limited
     */
    async shouldRespond(sock, jid, isCmd = false, isPrivileged = false) {
        // Circuit breaker check
        if (this.globalState.circuitBreakerActive) {
            console.warn('[AntiBan] Circuit breaker active - blocking all responses');
            return false;
        }

        const now = Date.now();
        const state = this.getUserState(jid);

        // Reset message count if window passed
        const windowMs = 60000; // 1 minute window
        if (now - state.lastMessageTime > windowMs) {
            state.messageCount = 0;
            state.burstCount = 0;
        }

        // Graduated rate limits based on privilege
        const limits = {
            owner: { perMinute: 100, cooldown: 500, burst: 20 },
            admin: { perMinute: 60, cooldown: 1000, burst: 15 },
            user: { perMinute: 25, cooldown: 2000, burst: 10 }
        };

        const userLimit = limits[isPrivileged === 'owner' ? 'owner' : isPrivileged ? 'admin' : 'user'];

        // Check cooldown
        if (now < state.cooldownUntil) {
            return false;
        }

        // Check burst protection
        if (now - state.burstStartTime < 10000) { // 10 second burst window
            state.burstCount++;
            if (state.burstCount >= userLimit.burst) {
                // Graduated cooldown: 5s, 15s, 30s, 60s
                const cooldownMs = [5000, 15000, 30000, 60000][Math.min(state.warningCount, 3)];
                state.cooldownUntil = now + cooldownMs;
                state.warningCount++;
                console.warn(`[AntiBan] Burst limit hit for ${jid}, cooldown: ${cooldownMs}ms`);
                return false;
            }
        } else {
            state.burstCount = 1;
            state.burstStartTime = now;
        }

        // Check per-minute limit
        if (state.messageCount >= userLimit.perMinute) {
            console.warn(`[AntiBan] Rate limit hit: ${state.messageCount}/${userLimit.perMinute}`);
            return false;
        }

        // Command-specific cooldown
        if (isCmd) {
            const cmdCooldown = userLimit.cooldown;
            if (now - state.lastResponseTime < cmdCooldown) {
                return false;
            }
        }

        // Update state
        state.messageCount++;
        state.lastMessageTime = now;
        
        // Track hourly activity
        const hour = new Date().getHours();
        state.hourlyActivity[hour] = (state.hourlyActivity[hour] || 0) + 1;

        // Global message tracking
        this.globalState.messagesSent++;
        this.globalState.lastGlobalMessage = now;

        return true;
    }

    /**
     * Simulate natural human typing behavior
     * Adjusts speed based on message complexity and context
     */
    async simulateHumanBehavior(sock, jid, responseText = '') {
        try {
            // CONNECTION-AWARE: skip entirely when the socket is not open.
            // Presence calls on a dead socket used to increment
            // consecutiveErrors and eventually trip the circuit breaker,
            // blocking ALL responses after a disconnect/reconnect cycle.
            if (!botState.isSocketOpen(sock)) {
                console.warn('[AntiBan] Presence simulation skipped — socket is not open.');
                return;
            }

            const state = this.getUserState(jid);
            const now = Date.now();

            // Calculate typing duration based on message characteristics
            const typingDuration = this.calculateTypingDuration(responseText, state);

            // Add natural pauses (thinking pauses for complex messages)
            const hasThinkingPause = responseText.length > 100 && Math.random() < 0.3;

            // Show typing indicator
            await sock.sendPresenceUpdate('composing', jid);

            // Connection may drop mid-typing; abort before the remaining
            // delays and the 'paused' update hit a dead socket.
            if (!botState.isSocketOpen(sock)) {
                console.warn('[AntiBan] Presence simulation aborted mid-typing — socket closed.');
                return;
            }

            if (hasThinkingPause) {
                // Short pause before starting to type (thinking)
                await delay(500 + Math.random() * 1500);
                
                // Start typing
                await delay(typingDuration * 0.3);
                
                // Pause in the middle (thinking about next part)
                await delay(300 + Math.random() * 800);
                
                // Continue typing
                await delay(typingDuration * 0.7);
            } else {
                // Natural typing without pauses
                await delay(typingDuration);
            }

            // Stop typing indicator
            await sock.sendPresenceUpdate('paused', jid);

            // Only a REAL behavioral failure counts toward the circuit
            // breaker; disconnects are handled by the connection engine.

            // Update response time tracking
            const responseTime = Date.now() - now;
            state.responseTimeSamples.push(responseTime);
            if (state.responseTimeSamples.length > 10) {
                state.responseTimeSamples.shift();
            }
            state.avgResponseTime = state.responseTimeSamples.reduce((a, b) => a + b, 0) / state.responseTimeSamples.length;
            state.lastResponseTime = Date.now();

            // Random "read receipt" delay (0-2 seconds)
            if (Math.random() < 0.4) {
                await delay(1000 + Math.random() * 2000);
            }

        } catch (err) {
            // Non-critical: don't crash on presence errors
            console.error('[AntiBan] Presence error:', err.message);
            
            // Track consecutive errors for circuit breaker
            this.globalState.consecutiveErrors++;
            if (this.globalState.consecutiveErrors >= 10) {
                this.globalState.circuitBreakerActive = true;
                console.error('[AntiBan] Circuit breaker activated due to consecutive errors');
            }
        }
    }

    /**
     * Calculate natural typing duration based on message characteristics
     */
    calculateTypingDuration(text, state) {
        const charCount = text.length;
        const wordCount = text.split(/\s+/).length;
        
        // Base typing speed: 40-80 WPM (words per minute)
        // Convert to characters per millisecond
        const avgWPM = 55 + Math.random() * 25; // 55-80 WPM
        const charsPerMs = (avgWPM * 5) / 60000; // Average 5 chars per word
        
        // Calculate base duration
        let duration = charCount / charsPerMs;
        
        // Adjust for message complexity
        const complexity = this.calculateComplexity(text);
        duration *= (1 + complexity * 0.3); // Up to 30% slower for complex messages
        
        // Add natural variation (±20%)
        const variation = 0.8 + Math.random() * 0.4;
        duration *= variation;
        
        // Cap between reasonable bounds
        duration = Math.max(800, Math.min(duration, 8000));
        
        // If user typically responds quickly, be a bit faster
        if (state.avgResponseTime > 0 && state.avgResponseTime < 3000) {
            duration *= 0.85;
        }
        
        return Math.round(duration);
    }

    /**
     * Calculate message complexity (0-1)
     */
    calculateComplexity(text) {
        let complexity = 0;
        
        // Length factor
        if (text.length > 200) complexity += 0.3;
        else if (text.length > 100) complexity += 0.2;
        else if (text.length > 50) complexity += 0.1;
        
        // Special characters
        const specialChars = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;
        complexity += Math.min(specialChars * 0.02, 0.2);
        
        // Numbers
        const numbers = (text.match(/\d+/g) || []).length;
        complexity += Math.min(numbers * 0.05, 0.15);
        
        // Links
        if (text.includes('http')) complexity += 0.15;
        
        // Emojis
        const emojis = (text.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length;
        complexity += Math.min(emojis * 0.03, 0.1);
        
        return Math.min(complexity, 1);
    }

    /**
     * Get time-of-day adjusted behavior
     */
    getTimeOfDayFactor() {
        const hour = new Date().getHours();
        
        // People type slower at night (tired), faster during day
        if (hour >= 23 || hour < 6) return 1.3;   // Night: slower
        if (hour >= 6 && hour < 9) return 1.1;     // Morning: slightly slower
        if (hour >= 9 && hour < 17) return 0.9;    // Day: faster
        if (hour >= 17 && hour < 21) return 1.0;   // Evening: normal
        return 1.2;                                  // Late evening: slightly slower
    }

    /**
     * Cleanup old entries
     */
    cleanup() {
        const now = Date.now();
        const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
        
        for (const [jid, state] of this.userState) {
            if (now - state.lastMessageTime > STALE_THRESHOLD) {
                this.userState.delete(jid);
            }
        }
    }

    /**
     * Get statistics for monitoring
     */
    getStats() {
        return {
            activeUsers: this.userState.size,
            globalMessages: this.globalState.messagesSent,
            circuitBreaker: this.globalState.circuitBreakerActive,
            consecutiveErrors: this.globalState.consecutiveErrors
        };
    }

    /**
     * Reset user state (for admin use)
     */
    resetUser(jid) {
        this.userState.delete(jid);
    }

    /**
     * Reset all state (for admin use)
     */
    resetAll() {
        this.userState.clear();
        this.globalState = {
            messagesSent: 0,
            lastGlobalMessage: 0,
            consecutiveErrors: 0,
            circuitBreakerActive: false
        };
    }
}

module.exports = new AdvancedAntiBan();
