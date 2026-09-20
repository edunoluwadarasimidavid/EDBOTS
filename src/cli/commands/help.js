/**
 * @file help.js
 * @description EDBots help command — shows available CLI commands.
 */

'use strict';

const pkg = require('../../../package.json');
const logger = require('../ui/logger');

function help() {
    logger.banner();

    console.log(`  \x1b[1mUSAGE:\x1b[0m`);
    console.log(`    edbots <command> [options]\n`);

    console.log(`  \x1b[1mCOMMANDS:\x1b[0m`);
    console.log(`    \x1b[32mstart\x1b[0m              Start the bot`);
    console.log(`    \x1b[32mstart --qr\x1b[0m         Start with QR code`);
    console.log(`    \x1b[32mstart --pair\x1b[0m       Start with pairing code`);
    console.log(`    \x1b[32mpair\x1b[0m               Pair with WhatsApp`);
    console.log(`    \x1b[32mpair --qr\x1b[0m          Pair using QR code`);
    console.log(`    \x1b[32mpair --code\x1b[0m        Pair using phone number`);
    console.log(`    \x1b[32mcustomize\x1b[0m          Interactive configuration wizard`);
    console.log(`    \x1b[32mstatus\x1b[0m             Show bot status`);
    console.log(`    \x1b[32msettings\x1b[0m           Manage bot settings`);
    console.log(`    \x1b[32mplugins\x1b[0m            List and manage plugins`);
    console.log(`    \x1b[32mlogs\x1b[0m               View bot logs`);
    console.log(`    \x1b[32mlogs --follow\x1b[0m      Follow logs in real-time`);
    console.log(`    \x1b[32mrestart\x1b[0m            Restart the bot`);
    console.log(`    \x1b[32mstop\x1b[0m               Stop the bot`);
    console.log(`    \x1b[32mupdate\x1b[0m             Check for updates`);
    console.log(`    \x1b[32mupdate --apply\x1b[0m     Apply latest update`);
    console.log(`    \x1b[32mhelp\x1b[0m               Show this help\n`);

    console.log(`  \x1b[1mOPTIONS:\x1b[0m`);
    console.log(`    \x1b[33m--version, -v\x1b[0m      Show version`);
    console.log(`    \x1b[33m--help, -h\x1b[0m         Show help\n`);

    console.log(`  \x1b[1mEXAMPLES:\x1b[0m`);
    console.log(`    \x1b[36medbots start\x1b[0m                Start with interactive auth`);
    console.log(`    \x1b[36medbots start --qr\x1b[0m           Start with QR code`);
    console.log(`    \x1b[36medbots customize\x1b[0m            Configure the bot`);
    console.log(`    \x1b[36medbots status\x1b[0m               Check bot status`);
    console.log(`    \x1b[36medbots plugins\x1b[0m              List all plugins\n`);

    console.log(`  \x1b[1mQUICK START:\x1b[0m`);
    console.log(`    1. \x1b[36mnpm install -g edbots\x1b[0m`);
    console.log(`    2. \x1b[36medbots start\x1b[0m`);
    console.log(`    3. Scan QR code or enter pairing code`);
    console.log(`    4. Bot is running!\n`);

    console.log(`  \x1b[90mDocumentation: https://github.com/EDBOTS/EDBOTS\x1b[0m`);
    console.log(`  \x1b[90mVersion: v${pkg.version}\x1b[0m\n`);
}

help();
