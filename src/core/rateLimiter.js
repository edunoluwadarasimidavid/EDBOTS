/**
 * Simple In-Memory Rate Limiter
 */

class RateLimiter {
    constructor() {
        this.userLimits = new Map();
        this.globalCount = 0;
        this.globalResetTime = Date.now() + 60000; // 1 minute
        this.maxPerUser = 10; // 10 messages per minute per user
        this.maxGlobal = 100; // 100 messages per minute globally
    }

    isLimited(userId) {
        const now = Date.now();

        // Global Reset
        if (now > this.globalResetTime) {
            this.globalCount = 0;
            this.globalResetTime = now + 60000;
        }

        // Global Limit check
        if (this.globalCount >= this.maxGlobal) {
            return true;
        }

        // User Reset/Check
        let userData = this.userLimits.get(userId);
        if (!userData || now > userData.resetTime) {
            userData = { count: 0, resetTime: now + 60000 };
        }

        if (userData.count >= this.maxPerUser) {
            return true;
        }

        // Increment
        userData.count++;
        this.globalCount++;
        this.userLimits.set(userId, userData);

        return false;
    }
}

module.exports = new RateLimiter();
