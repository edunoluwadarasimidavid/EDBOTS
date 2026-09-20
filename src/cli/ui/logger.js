/**
 * @file logger.js
 * @description Colored CLI logger for EDBots.
 */

const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
};

const PREFIXES = {
    info: `${COLORS.cyan}ℹ${COLORS.reset}`,
    success: `${COLORS.green}✓${COLORS.reset}`,
    warn: `${COLORS.yellow}⚠${COLORS.reset}`,
    error: `${COLORS.red}✗${COLORS.reset}`,
    debug: `${COLORS.gray}●${COLORS.reset}`,
};

function log(level, message, ...args) {
    const prefix = PREFIXES[level] || PREFIXES.info;
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${COLORS.gray}[${timestamp}]${COLORS.reset} ${prefix} ${message}`, ...args);
}

module.exports = {
    info: (msg, ...args) => log('info', msg, ...args),
    success: (msg, ...args) => log('success', msg, ...args),
    warn: (msg, ...args) => log('warn', msg, ...args),
    error: (msg, ...args) => log('error', msg, ...args),
    debug: (msg, ...args) => log('debug', msg, ...args),
    
    // Direct console wrappers
    clear: () => console.clear(),
    
    // Box display
    box: (title, lines) => {
        const width = Math.max(title.length + 4, ...lines.map(l => l.length + 4));
        console.log(`\n${COLORS.cyan}╭${'─'.repeat(width)}╮${COLORS.reset}`);
        console.log(`${COLORS.cyan}│${COLORS.reset} ${COLORS.bold}${title.padEnd(width - 1)}${COLORS.reset}${COLORS.cyan}│${COLORS.reset}`);
        console.log(`${COLORS.cyan}╰${'─'.repeat(width)}╯${COLORS.reset}`);
        lines.forEach(line => {
            console.log(`  ${line}`);
        });
        console.log('');
    },
    
    // Banner
    banner: () => {
        console.log(`
${COLORS.cyan}${COLORS.bold}
╔══════════════════════════════════════════╗
║          🤖 EDBots CLI                   ║
║    Advanced WhatsApp Bot Framework        ║
╚══════════════════════════════════════════╝
${COLORS.reset}`);
    },

    COLORS,
};
