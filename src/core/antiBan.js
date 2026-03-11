/**
 * Anti-Ban Protection Layer
 */

const { randomDelay } = require('../utils/delay');
const logger = require('../utils/logger');
const rateLimiter = require('./rateLimiter');

class AntiBan {
    constructor() {
        this.cooldowns = new Map();
    }

    /**
     * Filters messages to determine if the bot should respond
     */
    async shouldRespond(parsedMsg) {
        const { sender, isBot, from, isCmd, body } = parsedMsg;

        // 1. Ignore messages from bots or self
        if (isBot) return false;

        // 2. Message length limiter (prevent long spam)
        if (body && body.length > 2000) {
            logger.warn(`Ignored long message (${body.length} chars) from ${sender}`);
            return false;
        }

        // 3. Rate limiting check
        if (rateLimiter.isLimited(sender)) {
            logger.warn(`Rate limit hit for ${sender}`);
            return false;
        }

        // 3. Command cooldown check
        if (isCmd) {
            const now = Date.now();
            const lastUsed = this.cooldowns.get(sender) || 0;
            const cooldownAmount = 3000; // 3 seconds between commands

            if (now < lastUsed + cooldownAmount) {
                logger.info(`Cooldown active for ${sender}`);
                return false;
            }
            this.cooldowns.set(sender, now);
        }

        return true;
    }

    /**
     * Simulates human-like behavior before sending a message
     */
    async simulateHumanBehavior(sock, jid) {
        // Random typing duration
        await sock.presenceObserve(jid); // Signal bot is online
        await sock.sendPresenceUpdate('composing', jid);
        
        // Random delay between 1-4 seconds as requested
        await randomDelay(1000, 4000);
        
        await sock.sendPresenceUpdate('paused', jid);
    }
}

module.exports = new AntiBan();
