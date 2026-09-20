/**
 * @file defaults.js
 * @description Default configuration values for EDBots.
 * 
 * These are safe defaults that work out of the box.
 * User customization is stored in data/config.json.
 */

const defaults = {
    // Framework identity (DO NOT CHANGE)
    framework: {
        name: 'EDBots',
        version: '2.0.0',
    },

    // Bot display identity (user customizable)
    bot: {
        displayName: 'EDBots',
        description: 'Advanced WhatsApp AI Bot powered by EDBots Framework',
        prefix: '.',
        timezone: 'Africa/Lagos',
        packname: 'EDBots',
        sessionName: 'session',
    },

    // Owner identity
    owner: {
        name: '',
        number: '',
    },

    // Feature toggles
    behavior: {
        selfMode: false,
        autoRead: false,
        autoTyping: false,
        autoBio: false,
        autoSticker: false,
        autoReact: false,
        autoReactMode: 'bot',
        autoDownload: false,
        autoReply: false,
    },

    // Group defaults
    group: {
        welcome: true,
        goodbye: false,
        antilink: false,
        antispam: false,
        anticall: false,
        antidelete: false,
        detect: false,
        chatbot: false,
        nsfw: false,
        autosticker: false,
    },

    // AI settings
    ai: {
        enabled: true,
        personality: 'friendly',
        provider: 'puter',
    },

    // System
    system: {
        logLevel: 'info',
        debug: false,
        autoRestart: false,
    },

    // Social links
    social: {
        github: 'https://github.com/EDBOTS',
        instagram: '',
        youtube: '',
    },
};

module.exports = {
    getAll() {
        return JSON.parse(JSON.stringify(defaults));
    },
    get(keyPath) {
        const keys = keyPath.split('.');
        let value = defaults;
        for (const key of keys) {
            if (value === undefined || value === null) return undefined;
            value = value[key];
        }
        return value;
    }
};
