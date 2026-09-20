/**
 * @file status.js
 * @description EDBots status command — shows bot status and info.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../ui/logger');
const configManager = require('../../config/manager');
const { getFormattedUptime } = require('../../../utils/uptime');

function status() {
    logger.banner();

    // Load config
    configManager.load();

    // Check auth
    const sessionDir = path.join(process.cwd(), configManager.get('bot.sessionName') || 'session');
    const hasAuth = fs.existsSync(path.join(sessionDir, 'creds.json'));

    // Load version
    let version = 'unknown';
    try {
        const pkg = require('../../../package.json');
        version = pkg.version;
    } catch (e) {}

    // Count commands
    let commandCount = 0;
    try {
        const { loadCommands } = require('../../../utils/commandLoader');
        const commands = loadCommands();
        // Count unique commands (by name, not aliases)
        const unique = new Set();
        commands.forEach((cmd) => unique.add(cmd.name));
        commandCount = unique.size;
    } catch (e) {}

    // Uptime
    const uptime = getFormattedUptime() || 'Not running';

    // Display
    console.log('\x1b[1m\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    console.log('\x1b[1m\x1b[36m              EDBots Status                \x1b[0m');
    console.log('\x1b[1m\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');

    const lines = [
        `Framework:        EDBots`,
        `Version:          v${version}`,
        `Bot name:         ${configManager.get('bot.displayName')}`,
        ``,
        `WhatsApp:         ${hasAuth ? '\x1b[32mConnected\x1b[0m' : '\x1b[31mNot connected\x1b[0m'}`,
        `Authentication:   ${hasAuth ? '\x1b[32mValid\x1b[0m' : '\x1b[31mNot found\x1b[0m'}`,
        ``,
        `Commands:         ${commandCount} loaded`,
        `Prefix:           ${configManager.get('bot.prefix')}`,
        `Self mode:        ${configManager.get('behavior.selfMode') ? 'ON' : 'OFF'}`,
        `AI:               ${configManager.get('ai.enabled') ? 'ON' : 'OFF'}`,
        ``,
        `Uptime:           ${uptime}`,
    ];

    lines.forEach(line => console.log(`  ${line}`));
    console.log('\n');
}

status();
