/**
 * @file reset.js
 * @description EDBots reset command — resets configuration to defaults.
 * 
 * Unlike logout (which clears the session), reset restores
 * all configuration settings to their factory defaults.
 * 
 * Usage:
 *   edbots reset            Interactive reset (asks for confirmation)
 *   edbots reset --all      Reset config AND logout (danger zone)
 *   edbots reset --force    Skip confirmation
 */

'use strict';

const path = require('path');
const logger = require('../ui/logger');
const { ask, close } = require('../ui/prompts');
const configManager = require('../../config/manager');

const args = process.argv.slice(3);
const force = args.includes('--force') || args.includes('-f');
const resetAll = args.includes('--all');

async function reset() {
    logger.banner();
    logger.info('EDBots Reset\n');

    configManager.load();

    const current = configManager.get('bot.displayName') || 'EDBots';

    console.log('\x1b[1m\x1b[33m⚠ This will restore ALL configuration to defaults:\x1b[0m\n');
    console.log(`  • Bot display name:  "${current}" → "EDBots"`);
    console.log('  • Prefix:            → "."');
    console.log('  • Owner name/number: → cleared');
    console.log('  • All feature flags: → default values');
    console.log('');
    console.log('  Your WhatsApp session is \x1b[32mNOT\x1b[0m affected.');
    if (resetAll) {
        console.log('  \x1b[31m--all flag detected: session WILL also be deleted.\x1b[0m');
    }
    console.log('');

    // Confirmation with typed keyword
    if (!force) {
        const rl = require('../ui/prompts');
        const answer = await ask('Type RESET to confirm: ');
        close();

        if (answer !== 'RESET') {
            logger.info('Reset cancelled.');
            return;
        }
    }

    // Reset configuration
    logger.info('Resetting configuration...');
    configManager.reset();
    configManager.syncToLegacy();
    logger.success('Configuration reset to defaults');

    // Optionally also logout
    if (resetAll) {
        logger.info('Deleting WhatsApp session (--all)...');
        const fs = require('fs-extra');
        const sessionDir = path.join(process.cwd(), 'session');
        try {
            // Backup first
            const backupDir = path.join(process.cwd(), `session_backup_${Date.now()}`);
            if (fs.existsSync(sessionDir)) {
                await fs.copy(sessionDir, backupDir);
                logger.success(`Session backed up to: ${path.basename(backupDir)}`);
                await fs.remove(sessionDir);
                logger.success('Session deleted');
            }
        } catch (e) {
            logger.warn('Session cleanup failed:', e.message);
        }
    }

    console.log('\n');
    logger.success('Reset complete! 🎉');
    logger.info('');
    logger.info('Next steps:');
    logger.info('  \x1b[36medbots customize\x1b[0m  →  Reconfigure your bot');
    if (resetAll) {
        logger.info('  \x1b[36medbots start\x1b[0m      →  Pair again with WhatsApp');
    }
    console.log('');
}

reset().catch(err => {
    logger.error('Reset failed:', err.message);
    process.exit(1);
});
