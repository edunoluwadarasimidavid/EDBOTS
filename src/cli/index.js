#!/usr/bin/env node

/**
 * @file index.js
 * @description EDBots CLI Entry Point.
 * 
 * Usage:
 *   edbots <command> [options]
 *   edbots --help
 *   edbots --version
 * 
 * Commands:
 *   start       Start the bot
 *   customize   Interactive configuration wizard
 *   pair        Pair with WhatsApp (QR or code)
 *   status      Show bot status
 *   settings    Manage settings
 *   plugins     Manage plugins/commands
 *   logs        View logs
 *   restart     Restart the bot
 *   stop        Stop the bot
 *   update      Check for updates
 *   logout      Disconnect WhatsApp & reset session
 *   reset       Reset configuration to defaults
 *   doctor      Diagnose common problems
 *   help        Show help
 */

'use strict';

const path = require('path');
const pkg = require('../../package.json');

// Ensure we're running from the project root
const PROJECT_ROOT = path.resolve(__dirname, '../..');
process.chdir(PROJECT_ROOT);

// Parse arguments
const args = process.argv.slice(2);
const command = args[0];
const flags = args.slice(1);

// Version - check both command and flags
if (command === '--version' || command === '-v' || flags.includes('--version') || flags.includes('-v')) {
    console.log(`EDBots v${pkg.version}`);
    process.exit(0);
}

// Help - check both command and flags
if (command === '--help' || command === '-h' || flags.includes('--help') || flags.includes('-h') || !command) {
    showHelp();
    process.exit(0);
}

// Command dispatch
const commands = {
    start: () => require('./commands/start'),
    customize: () => require('./commands/customize'),
    pair: () => require('./commands/pair'),
    status: () => require('./commands/status'),
    settings: () => require('./commands/settings'),
    plugins: () => require('./commands/plugins'),
    logs: () => require('./commands/logs'),
    restart: () => require('./commands/restart'),
    stop: () => require('./commands/stop'),
    update: () => require('./commands/update'),
    logout: () => require('./commands/logout'),
    reset: () => require('./commands/reset'),
    doctor: () => require('./commands/doctor'),
    help: () => { showHelp(); process.exit(0); },
};

function showHelp() {
    console.log(`
\x1b[1m\x1b[36m╔══════════════════════════════════════════╗
║          🤖 EDBots CLI v${pkg.version}           ║
║    Advanced WhatsApp Bot Framework        ║
╚══════════════════════════════════════════╝\x1b[0m

\x1b[1mUSAGE:\x1b[0m
  edbots <command> [options]

\x1b[1mCOMMANDS:\x1b[0m
  \x1b[32mstart\x1b[0m              Start the bot
  \x1b[32mstart --qr\x1b[0m         Start with QR code authentication
  \x1b[32mstart --pair\x1b[0m       Start with pairing code
  \x1b[32mpair\x1b[0m               Pair with WhatsApp
  \x1b[32mpair --qr\x1b[0m          Pair using QR code
  \x1b[32mpair --code\x1b[0m        Pair using phone number
  \x1b[32mcustomize\x1b[0m          Interactive configuration wizard
  \x1b[32mstatus\x1b[0m             Show bot status and info
  \x1b[32msettings\x1b[0m           Manage bot settings
  \x1b[32mplugins\x1b[0m            List and manage plugins
  \x1b[32mlogs\x1b[0m               View bot logs
  \x1b[32mlogs --follow\x1b[0m      Follow logs in real-time
  \x1b[32mrestart\x1b[0m            Restart the bot
  \x1b[32mstop\x1b[0m               Stop the bot gracefully
  \x1b[32mupdate\x1b[0m             Check for and apply updates
  \x1b[32mupdate --apply\x1b[0m     Apply latest update
  \x1b[32mlogout\x1b[0m             Disconnect WhatsApp & reset session
  \x1b[32mlogout --force\x1b[0m     Logout without confirmation
  \x1b[32mreset\x1b[0m              Reset configuration to defaults
  \x1b[32mreset --all\x1b[0m        Reset config AND logout
  \x1b[32mdoctor\x1b[0m             Diagnose common problems
  \x1b[32mhelp\x1b[0m               Show this help message

\x1b[1mOPTIONS:\x1b[0m
  \x1b[33m--version, -v\x1b[0m      Show version
  \x1b[33m--help, -h\x1b[0m         Show this help

\x1b[1mEXAMPLES:\x1b[0m
  \x1b[36medbots start\x1b[0m                Start with interactive auth
  \x1b[36medbots start --qr\x1b[0m           Start with QR code
  \x1b[36medbots customize\x1b[0m            Configure the bot
  \x1b[36medbots status\x1b[0m               Check bot status
  \x1b[36medbots logout\x1b[0m               Disconnect & re-pair later
  \x1b[36medbots doctor\x1b[0m               Diagnose problems

\x1b[1mQUICK START:\x1b[0m
  1. \x1b[36mnpm install -g edbots\x1b[0m
  2. \x1b[36medbots start\x1b[0m
  3. Scan QR code or enter pairing code
  4. Bot is running!

\x1b[90mDocumentation: https://github.com/EDBOTS/EDBOTS\x1b[0m
`);
}

// Dispatch command
try {
    const loader = commands[command];
    if (loader) {
        loader();
    } else {
        console.error(`\x1b[31mUnknown command: ${command}\x1b[0m`);
        console.log(`Run \x1b[36medbots help\x1b[0m for available commands.`);
        process.exit(1);
    }
} catch (err) {
    console.error(`\x1b[31mFailed to load command '${command}':\x1b[0m`, err.message);
    process.exit(1);
}
