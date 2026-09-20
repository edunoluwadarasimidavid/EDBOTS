/**
 * @file settings.js
 * @description EDBots settings management command.
 */

'use strict';

const logger = require('../ui/logger');
const { ask, askChoice, close } = require('../ui/prompts');
const configManager = require('../../config/manager');

async function settings() {
    logger.banner();

    configManager.load();

    while (true) {
        console.log('\x1b[1m\x1b[36m━━━ EDBots Settings ━━━\x1b[0m\n');
        console.log('  [1] View configuration');
        console.log('  [2] Customize bot');
        console.log('  [3] Reset configuration');
        console.log('  [4] Validate configuration');
        console.log('  [5] Back');
        console.log('');

        const choice = await ask('Select an option: ');

        switch (choice) {
            case '1': {
                console.log('\n\x1b[1m\x1b[36m━━━ Current Configuration ━━━\x1b[0m\n');
                const config = configManager.getAll();
                
                // Display key settings
                console.log(`  Display name:     ${config.bot?.displayName}`);
                console.log(`  Description:      ${config.bot?.description}`);
                console.log(`  Prefix:           ${config.bot?.prefix}`);
                console.log(`  Owner:            ${config.owner?.name || '(not set)'} (${config.owner?.number || '(not set)'})`);
                console.log(`  Timezone:         ${config.bot?.timezone}`);
                console.log('');
                console.log(`  Auto-read:        ${config.behavior?.autoRead ? 'ON' : 'OFF'}`);
                console.log(`  Auto-typing:      ${config.behavior?.autoTyping ? 'ON' : 'OFF'}`);
                console.log(`  Auto-react:       ${config.behavior?.autoReact ? 'ON' : 'OFF'}`);
                console.log(`  AI auto-reply:    ${config.behavior?.autoReply ? 'ON' : 'OFF'}`);
                console.log(`  Self mode:        ${config.behavior?.selfMode ? 'ON' : 'OFF'}`);
                console.log('');
                console.log(`  Welcome:          ${config.group?.welcome ? 'ON' : 'OFF'}`);
                console.log(`  Anti-link:        ${config.group?.antilink ? 'ON' : 'OFF'}`);
                console.log(`  Anti-spam:        ${config.group?.antispam ? 'ON' : 'OFF'}`);
                console.log('');
                console.log(`  AI:               ${config.ai?.enabled ? 'ON' : 'OFF'}`);
                console.log('');
                break;
            }

            case '2': {
                close();
                require('./customize');
                return;
            }

            case '3': {
                const { askYesNo } = require('../ui/prompts');
                console.log('\n\x1b[31m⚠ Warning: This will restore default settings.\x1b[0m');
                const confirm = await askYesNo('Are you sure?', false);
                
                if (confirm) {
                    const typed = await ask('Type RESET to confirm: ');
                    if (typed === 'RESET') {
                        configManager.reset();
                        logger.success('Configuration reset to defaults.');
                    } else {
                        logger.info('Reset cancelled.');
                    }
                } else {
                    logger.info('Reset cancelled.');
                }
                console.log('');
                break;
            }

            case '4': {
                const result = configManager.validate();
                console.log('\n\x1b[1m\x1b[36m━━━ Validation Results ━━━\x1b[0m\n');
                
                if (result.valid) {
                    logger.success('Configuration is valid');
                } else {
                    result.errors.forEach(e => logger.error(e));
                }
                
                if (result.warnings.length > 0) {
                    result.warnings.forEach(w => logger.warn(w));
                } else {
                    logger.success('No warnings');
                }
                console.log('');
                break;
            }

            case '5':
            case 'quit':
            case 'exit': {
                close();
                return;
            }

            default:
                logger.warn('Invalid option');
                console.log('');
        }
    }
}

settings().catch(err => {
    logger.error('Settings error:', err.message);
    process.exit(1);
});
