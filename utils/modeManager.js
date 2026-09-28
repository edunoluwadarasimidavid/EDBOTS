/**
 * @file modeManager.js
 * @description Manages bot operating modes: personal, business, group
 * Supports per-chat and global mode switching with persistence.
 */

const fs = require('fs');
const path = require('path');

const MODES_FILE = path.join(__dirname, '../data/botModes.json');

// Every category that exists in commands/. Used by permissive modes.
const ALL_CATEGORIES = [
    'ai', 'fun', 'media', 'utility', 'general', 'menu', 'system',
    'anime', 'premium', 'textmaker', 'business', 'group', 'admin', 'owner'
];

// Available modes
const MODES = {
    personal: {
        name: 'Personal',
        emoji: '👤',
        description: 'Full-featured personal assistant with all commands',
        features: [...ALL_CATEGORIES]
    },
    business: {
        name: 'Business',
        emoji: '💼',
        description: 'Professional mode with business tools, auto-replies, and analytics',
        features: ['ai', 'business', 'utility', 'general', 'menu', 'system']
    },
    group: {
        name: 'Group',
        emoji: '👥',
        description: 'Group-focused mode with moderation and management tools',
        features: ['ai', 'group', 'admin', 'utility', 'general', 'menu', 'system']
    },
    owner: {
        name: 'Owner',
        emoji: '👑',
        description: 'Full admin access with restricted commands',
        features: [...ALL_CATEGORIES]
    }
};

class ModeManager {
    constructor() {
        this.modes = this.load();
    }

    load() {
        try {
            if (!fs.existsSync(MODES_FILE)) {
                fs.writeFileSync(MODES_FILE, JSON.stringify({}));
                return {};
            }
            return JSON.parse(fs.readFileSync(MODES_FILE, 'utf8'));
        } catch (e) {
            return {};
        }
    }

    save() {
        try {
            const dir = path.dirname(MODES_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(MODES_FILE, JSON.stringify(this.modes, null, 2));
        } catch (e) {
            console.error('[ModeManager] Save error:', e);
        }
    }

    /**
     * Get the current mode for a chat
     * @param {string} chatId - JID of the chat
     * @returns {string} Current mode key
     */
    getMode(chatId) {
        return this.modes[chatId] || 'personal';
    }

    /**
     * Set mode for a chat
     * @param {string} chatId - JID of the chat
     * @param {string} mode - Mode key (personal, business, group, owner)
     * @returns {boolean} Success
     */
    setMode(chatId, mode) {
        if (!MODES[mode]) return false;
        this.modes[chatId] = mode;
        this.save();
        return true;
    }

    /**
     * Get mode info object
     */
    getModeInfo(mode) {
        return MODES[mode] || MODES.personal;
    }

    /**
     * Check if a command category is allowed in the current mode.
     * Navigation (menu) and diagnostics (system) are always available so
     * users can always see the menu and check the bot's health.
     */
    isAllowed(mode, category) {
        if (category === 'menu' || category === 'system') return true;
        const modeInfo = MODES[mode];
        if (!modeInfo) return true; // Default: allow all
        return modeInfo.features.includes(category);
    }

    /**
     * Get all available modes
     */
    getAllModes() {
        return Object.entries(MODES).map(([key, val]) => ({
            key,
            ...val
        }));
    }

    /**
     * Reset a chat to default mode
     */
    resetMode(chatId) {
        delete this.modes[chatId];
        this.save();
    }

    /**
     * Get all active mode assignments (for admin viewing)
     */
    getAllAssignments() {
        const result = {};
        for (const [chatId, mode] of Object.entries(this.modes)) {
            result[chatId] = {
                mode,
                modeInfo: MODES[mode]
            };
        }
        return result;
    }
}

module.exports = new ModeManager();
