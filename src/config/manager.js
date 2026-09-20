/**
 * @file manager.js
 * @description Centralized Configuration Manager for EDBots.
 * 
 * Wraps the existing config.js with JSON persistence, validation,
 * and safe defaults. Maintains full backward compatibility.
 */

const fs = require('fs');
const path = require('path');
const defaults = require('./defaults');

const ROOT_DIR = path.resolve(__dirname, '../..');
const CONFIG_FILE = path.join(ROOT_DIR, 'data', 'config.json');

class ConfigManager {
    constructor() {
        this.config = null;
        this.load();
    }

    /**
     * Load configuration from file, falling back to defaults
     */
    load() {
        try {
            const dir = path.dirname(CONFIG_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            if (fs.existsSync(CONFIG_FILE)) {
                const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
                try {
                    const saved = JSON.parse(raw);
                    this.config = this.merge(defaults.getAll(), saved);
                } catch (parseErr) {
                    console.error('[Config] Corrupted config file, backing up and using defaults');
                    const backupPath = CONFIG_FILE + '.backup.' + Date.now();
                    fs.copyFileSync(CONFIG_FILE, backupPath);
                    this.config = defaults.getAll();
                    this.save();
                }
            } else {
                this.config = defaults.getAll();
                this.save();
            }
        } catch (err) {
            console.error('[Config] Load error:', err.message);
            this.config = defaults.getAll();
        }
    }

    /**
     * Save configuration to file
     */
    save() {
        try {
            const dir = path.dirname(CONFIG_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            
            // Atomic write
            const tempPath = CONFIG_FILE + '.tmp';
            fs.writeFileSync(tempPath, JSON.stringify(this.config, null, 2));
            fs.renameSync(tempPath, CONFIG_FILE);
            return true;
        } catch (err) {
            console.error('[Config] Save error:', err.message);
            return false;
        }
    }

    /**
     * Deep merge objects (target wins for existing keys, source fills gaps)
     */
    merge(target, source) {
        const result = { ...target };
        for (const key of Object.keys(source)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key]) {
                result[key] = this.merge(target[key], source[key]);
            } else if (source[key] !== undefined && source[key] !== '') {
                result[key] = source[key];
            }
        }
        return result;
    }

    /**
     * Get a config value by dot-notation path
     * e.g. get('bot.displayName') returns config.bot.displayName
     */
    get(keyPath) {
        const keys = keyPath.split('.');
        let value = this.config;
        for (const key of keys) {
            if (value === undefined || value === null) return undefined;
            value = value[key];
        }
        return value;
    }

    /**
     * Set a config value by dot-notation path
     */
    set(keyPath, value) {
        const keys = keyPath.split('.');
        let obj = this.config;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') {
                obj[keys[i]] = {};
            }
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
        return this.save();
    }

    /**
     * Get the full config object
     */
    getAll() {
        return { ...this.config };
    }

    /**
     * Reset to defaults (with confirmation)
     */
    reset() {
        this.config = defaults.getAll();
        return this.save();
    }

    /**
     * Validate the current configuration
     */
    validate() {
        const errors = [];
        const warnings = [];

        // Required fields
        if (!this.config.bot?.displayName) {
            warnings.push('Bot display name not set');
        }
        if (!this.config.owner?.number) {
            warnings.push('Owner phone number not set');
        }

        // Prefix validation
        if (this.config.bot?.prefix && this.config.bot.prefix.length > 3) {
            warnings.push('Command prefix is unusually long');
        }

        return { valid: errors.length === 0, errors, warnings };
    }

    /**
     * Get only user-customizable settings (for the customize wizard)
     */
    getCustomizableSettings() {
        return [
            // Identity
            { key: 'bot.displayName', label: 'Bot display name', current: this.get('bot.displayName'), category: 'identity' },
            { key: 'bot.description', label: 'Bot description', current: this.get('bot.description'), category: 'identity' },
            { key: 'bot.prefix', label: 'Command prefix', current: this.get('bot.prefix'), category: 'identity' },
            { key: 'owner.name', label: 'Owner name', current: this.get('owner.name'), category: 'identity' },
            { key: 'owner.number', label: 'Owner number', current: this.get('owner.number'), category: 'identity' },
            { key: 'bot.timezone', label: 'Timezone', current: this.get('bot.timezone'), category: 'identity' },

            // Message Behavior
            { key: 'behavior.autoRead', label: 'Auto-read messages', current: this.get('behavior.autoRead'), type: 'boolean', category: 'behavior' },
            { key: 'behavior.autoTyping', label: 'Auto-typing indicator', current: this.get('behavior.autoTyping'), type: 'boolean', category: 'behavior' },
            { key: 'behavior.autoReact', label: 'Auto-react to messages', current: this.get('behavior.autoReact'), type: 'boolean', category: 'behavior' },
            { key: 'behavior.autoReply', label: 'AI auto-reply', current: this.get('behavior.autoReply'), type: 'boolean', category: 'behavior' },
            { key: 'behavior.selfMode', label: 'Self mode (owner only)', current: this.get('behavior.selfMode'), type: 'boolean', category: 'behavior' },

            // Group Behavior
            { key: 'group.welcome', label: 'Welcome messages', current: this.get('group.welcome'), type: 'boolean', category: 'group' },
            { key: 'group.goodbye', label: 'Goodbye messages', current: this.get('group.goodbye'), type: 'boolean', category: 'group' },
            { key: 'group.antilink', label: 'Anti-link protection', current: this.get('group.antilink'), type: 'boolean', category: 'group' },
            { key: 'group.antispam', label: 'Anti-spam', current: this.get('group.antispam'), type: 'boolean', category: 'group' },
            { key: 'group.anticall', label: 'Anti-call', current: this.get('group.anticall'), type: 'boolean', category: 'group' },

            // AI
            { key: 'ai.enabled', label: 'AI features', current: this.get('ai.enabled'), type: 'boolean', category: 'ai' },
            { key: 'ai.personality', label: 'AI personality', current: this.get('ai.personality'), category: 'ai' },
        ];
    }

    /**
     * Sync settings back to the legacy config.js format
     * This ensures the existing bot code reads correct values
     */
    syncToLegacy() {
        try {
            const configPath = path.join(ROOT_DIR, 'config.js');
            if (!fs.existsSync(configPath)) return;

            let content = fs.readFileSync(configPath, 'utf8');

            // Sync bot name
            if (this.config.bot?.displayName) {
                content = content.replace(/botName:\s*'[^']*'/, `botName: '${this.config.bot.displayName}'`);
                content = content.replace(/packname:\s*'[^']*'/, `packname: '${this.config.bot.displayName}'`);
            }

            // Sync prefix
            if (this.config.bot?.prefix) {
                content = content.replace(/prefix:\s*'[^']*'/, `prefix: '${this.config.bot.prefix}'`);
            }

            // Sync owner number
            if (this.config.owner?.number) {
                const ownerArr = `['${this.config.owner.number}','${this.config.owner.number}']`;
                content = content.replace(/owner:\s*\['[^']*','[^']*'\]/, `owner: ${ownerArr}`);
            }

            // Sync behavior flags
            const boolFlags = ['selfMode', 'autoRead', 'autoTyping', 'autoReact', 'autoReply'];
            for (const flag of boolFlags) {
                const key = flag === 'selfMode' ? 'behavior.selfMode' : 
                           flag === 'autoRead' ? 'behavior.autoRead' :
                           flag === 'autoTyping' ? 'behavior.autoTyping' :
                           flag === 'autoReact' ? 'behavior.autoReact' :
                           'behavior.autoReply';
                const val = this.get(key);
                if (val !== undefined) {
                    const regex = new RegExp(`${flag}:\\s*(true|false)`, 'g');
                    content = content.replace(regex, `${flag}: ${val}`);
                }
            }

            fs.writeFileSync(configPath, content);
            
            // Clear require cache so the bot picks up changes
            delete require.cache[require.resolve(path.join(ROOT_DIR, 'config.js'))];
            
            return true;
        } catch (err) {
            console.error('[Config] Sync to legacy failed:', err.message);
            return false;
        }
    }
}

// Singleton
module.exports = new ConfigManager();
