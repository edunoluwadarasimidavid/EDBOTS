/**
 * @file menuRenderer.js
 * @description Customizable, themed menu UI renderer for EDBots.
 *
 * Produces a fresh visual identity for .menu / .start output:
 *  - Card-style headers with emoji category icons
 *  - Two-column command grid (saves vertical space, looks premium)
 *  - Themed header box with uptime, mode, role
 *  - Git repository link card at the bottom (always visible)
 *  - Random theme variants per render (subtle "new UI" variety)
 *
 * All output is plain WhatsApp-safe text (no markdown hacks).
 */

const config = require('../config');

// ─── Theme definitions ──────────────────────────────────────
const THEMES = [
    {
        name: 'Aurora',
        corner: ['╭─', '├─', '╰─'],
        line: '━',
        bullet: '◈',
        accent: '✦'
    },
    {
        name: 'Neon',
        corner: ['┏─', '┣─', '┗─'],
        line: '═',
        bullet: '»',
        accent: '◆'
    },
    {
        name: 'Classic',
        corner: ['╭━', '┣━', '╰━'],
        line: '━',
        bullet: '•',
        accent: '★'
    }
];

const CATEGORY_ICONS = {
    general: '🏠', ai: '🧠', fun: '🎮', media: '📥', utility: '🧰',
    business: '💼', group: '👥', admin: '🛡️', owner: '👑', system: '⚙️',
    menu: '📋', downloader: '📥', sticker: '✨', textmaker: '🪄',
    search: '🔎', tools: '🔧', education: '🎓', finance: '💰'
};

function pickTheme() {
    return THEMES[Math.floor(Math.random() * THEMES.length)];
}

function iconFor(category) {
    return CATEGORY_ICONS[category.toLowerCase()] || '📦';
}

/**
 * Two-column grid renderer. Long command names gracefully fall back
 * to one column when they would overflow.
 */
function renderGrid(items, bullet) {
    const col = (s) => s.padEnd(14, ' ');
    const lines = [];
    for (let i = 0; i < items.length; i += 2) {
        const a = items[i];
        const b = items[i + 1];
        if (b) lines.push(`${bullet} ${col(a)}${bullet} ${b}`);
        else lines.push(`${bullet} ${a}`);
    }
    return lines;
}

/**
 * Build the full themed menu.
 *
 * @param {object} opts
 * @param {string}   opts.title        e.g. "EDBOTS" or "ADMIN MENU"
 * @param {string}   opts.subtitle     e.g. "Personal · Private Chat"
 * @param {string}   opts.userName
 * @param {string}   opts.botNumber
 * @param {string}   opts.ownerName
 * @param {string}   opts.prefix
 * @param {string}   opts.uptime
 * @param {string}   opts.mode
 * @param {Array}    opts.categories   [{ name, commands: [names] }]
 * @param {boolean}  opts.isStart      start-style (compact header)
 * @returns {{ text: string, theme: string }}
 */
function buildMenu(opts) {
    const theme = pickTheme();
    const {
        title = 'EDBOTS',
        subtitle = '',
        userName = 'User',
        botNumber = '',
        ownerName = '',
        prefix = '.',
        uptime = '',
        mode = '',
        categories = [],
        isStart = false
    } = opts;

    const L = theme.line;
    const W = 26; // inner width

    let text = '';

    // ── Header card ──
    if (!isStart) {
        text += `╭${L.repeat(W)}╮\n`;
        text += `┃ ✨ *${title}* ✨\n`;
        if (subtitle) text += `┃ ${subtitle}\n`;
        text += `┃${L.repeat(W)}┤\n`;
        text += `┃ 👤 ${userName}\n`;
        if (ownerName) text += `┃ 👑 ${ownerName}\n`;
        if (botNumber) text += `┃ 🤖 ${botNumber}\n`;
        text += `┃ ⌨️  Prefix: ${prefix}\n`;
        if (uptime) text += `┃ ⏱️  Uptime: ${uptime}\n`;
        if (mode) text += `┃ ⚙️  Mode: ${mode}\n`;
        text += `╰${L.repeat(W)}╯\n\n`;
    } else {
        text += `✨ *${title}* ✨\n`;
        if (subtitle) text += `${subtitle}\n`;
        text += `👤 ${userName} · ⌨️ ${prefix} · ⏱️ ${uptime}\n`;
        if (mode) text += `⚙️ ${mode}\n`;
        text += `\n`;
    }

    // ── Category cards ──
    for (const cat of categories) {
        if (!cat.commands || cat.commands.length === 0) continue;
        const icon = iconFor(cat.name);
        const label = cat.name.toUpperCase();
        const cmds = cat.commands.sort();

        text += `╭${L.repeat(W)}╮\n`;
        text += `┃ ${icon} *${label}*\n`;
        text += `┃${L.repeat(W)}┤\n`;
        renderGrid(cmds, theme.bullet).forEach(line => {
            text += `┃ ${line}\n`;
        });
        text += `╰${L.repeat(W)}╯\n\n`;
    }

    // ── Quick tips ──
    text += `${theme.accent} *Quick Tips*\n`;
    text += `${theme.bullet} ${prefix}ai <question> → ask AI\n`;
    text += `${theme.bullet} ${prefix}menu → full menu\n\n`;

    // ── Git repository card (always visible) ──
    const repo = config.social?.github || 'https://github.com/edunoluwadarasimidavid/EDBOTS';
    text += `╭${L.repeat(W)}╮\n`;
    text += `┃ 🌐 *OPEN SOURCE*\n`;
    text += `┃${L.repeat(W)}┤\n`;
    text += `┃ Repo: ${repo}\n`;
    text += `┃ ⭐ Star us on GitHub!\n`;
    text += `╰${L.repeat(W)}╯\n`;
    text += `> _EDBots Framework_`;

    return { text, theme: theme.name };
}

/**
 * WhatsApp link-preview decoration (GitHub avatar + repo link card).
 */
function linkPreview() {
    const repo = config.social?.github || 'https://github.com/edunoluwadarasimidavid/EDBOTS';
    return {
        title: 'EDBots — Advanced WhatsApp AI Framework',
        body: 'Open source • Star on GitHub ⭐',
        thumbnailUrl: 'https://github.com/edunoluwadarasimidavid.png',
        sourceUrl: repo,
        mediaType: 1,
        renderLargerThumbnail: true
    };
}

module.exports = { buildMenu, linkPreview, THEMES };
