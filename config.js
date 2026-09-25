/**
 * @file config.js
 * @description Central EDBOTS configuration for normal feature settings.
 *
 * Provider and bot feature settings live here so they do not depend on
 * environment variables. Secrets (API keys, tokens, master passwords) are
 * still read from the environment when present — .env.example only holds
 * the Appwrite backend variables.
 *
 * Everything below is safe to edit: every setting has a sensible default
 * and the bot works out of the box without changes.
 */

// ── Owner identity ──────────────────────────────────────────────────
// WhatsApp numbers (digits only, international format) that own the bot.
// Add your number(s) below, e.g. '2348012345678'. Owner-only commands and
// premium features check against this list.
//
// The OWNER_NUMBER environment variable (comma-separated) still works and
// overrides this list when set — deployment identities belong here, not in
// the shipped .env template.
const owners = [
    // '2348012345678'
];

const envOwnerNumbers = (process.env.OWNER_NUMBER || '')
    .split(',')
    .map(n => n.trim())
    .filter(n => /^[0-9]{8,15}$/.test(n));

const ownerNumbers = envOwnerNumbers.length ? envOwnerNumbers : owners;

module.exports = {
    // ── Bot identity ────────────────────────────────────────────────────
    botName: 'EDBots',
    ownerName: ['EDBOTS', 'Edun Oluwadarasimi David'],
    owner: ownerNumbers,
    // Same owners as raw digits (used by the .owner vCard waid field)
    ownerNumber: ownerNumbers,
    prefix: '.',
    sessionName: 'session', // folder for WhatsApp auth state
    packname: 'EDBots',     // sticker pack name
    newsletterJid: '120363407258579577@newsletter',
    updateZipUrl: 'https://github.com/edunoluwadarasimidavid/EDBOTS/archive/refs/heads/main.zip',

    // ── Bot behavior toggles ────────────────────────────────────────────
    selfMode: false,
    autoRead: false,
    autoTyping: false,
    autoBio: false,
    autoSticker: false,
    autoReact: false,
    autoReactMode: 'bot',
    autoDownload: false,
    autoReply: false,

    // ── Web pairing (headless servers) ───────────────────────────────
    // First-time WhatsApp authentication UI served at /pair when the bot
    // runs without an interactive terminal (Render, Railway, VPS, Docker…).
    // Everything here is OPTIONAL — the URL is auto-detected from the
    // hosting platform (Render/Railway/Fly/Heroku/Codespaces/…) or learned
    // from the first browser request, and LAN IPs are shown as fallbacks.
    // Only set publicUrl if auto-detection can't know your address (e.g. a
    // custom domain behind a proxy). .env is NOT used for this.
    webPairing: {
        enabled: true,
        // e.g. 'https://my-bot.example.com' — leave '' for auto-detection
        publicUrl: ''
    },

    // ── AI features ─────────────────────────────────────────────────────
    // Provider preferences live here; provider API keys stay in .env.
    // provider: 'puter' (linked via .puter command) | 'ollama' | 'auto'
    ai: {
        enabled: true,
        provider: 'auto',
        personality: 'friendly',
        model: '',                          // optional model override
        ollamaUrl: 'http://localhost:11434', // local Ollama endpoint
        ollamaApiKey: ''                    // optional; not needed for local Ollama
    },

    // ── Group feature defaults (per-group overrides stored in database/) ─
    defaultGroupSettings: {
        antilink: false,
        antilinkAction: 'delete',
        antitag: false,
        antitagAction: 'delete',
        antiall: false,
        antiviewonce: false,
        antibot: false,
        anticall: false,
        antigroupmention: false,
        antigroupmentionAction: 'delete',
        welcome: true,
        welcomeMessage: '╭╼━≪•𝙽𝙴𝚆 𝙼𝙴𝙼𝙱𝙴𝚁•≫━╾╮\n┃𝚆𝙴𝙻𝙲𝙾𝙼𝙴: @user 👋\n┃Member count: #memberCount\n┃𝚃𝙸𝙼𝙴: time⏰\n╰━━━━━━━━━━━━━━━╯\n\n*@user* Welcome to *@group*! 🎉\n*Group 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽*\ngroupDesc\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ botName*',
        goodbye: false,
        goodbyeMessage: 'Goodbye @user 👋 We will never miss you!',
        antiSpam: false,
        antidelete: false,
        nsfw: false,
        detect: false,
        chatbot: false,
        autosticker: false
    },

    // ── Message templates ───────────────────────────────────────────────
    messages: {
        wait: '⏳ Please wait...',
        success: '✅ Success!',
        error: '❌ Error occurred!',
        ownerOnly: '👑 This command is only for bot owner!',
        adminOnly: '🛡️ This command is only for group admins!',
        groupOnly: '👥 This command can only be used in groups!',
        privateOnly: '💬 This command can only be used in private chat!',
        botAdminNeeded: '🤖 Bot needs to be admin to execute this command!',
        invalidCommand: '❓ Invalid command! Type .menu for help'
    },

    // ── Misc ────────────────────────────────────────────────────────────
    timezone: 'Asia/Kolkata',
    maxWarnings: 3,

    social: {
        github: 'https://github.com/edunoluwadarasimidavid/EDBOTS',
        instagram: 'https://instagram.com/edunoluwadarasimidavid',
        youtube: 'https://youtube.com/@edunoluwadarasimidavid?si=ZksmemM8EWFQsBbl'
    }
};
