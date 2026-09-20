/**
 * @file plugins.js
 * @description EDBots plugins management command.
 */

'use strict';

const logger = require('../ui/logger');
const { ask, askChoice, close } = require('../ui/prompts');

function listPlugins() {
    logger.info('Loading plugins...\n');
    
    try {
        const { loadCommands } = require('../../../utils/commandLoader');
        const commands = loadCommands();
        
        // Group by category
        const categories = {};
        const uniqueCommands = new Map();
        
        commands.forEach((cmd) => {
            if (!uniqueCommands.has(cmd.name)) {
                uniqueCommands.set(cmd.name, cmd);
                const cat = cmd.category || 'general';
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(cmd);
            }
        });

        console.log('\x1b[1m\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
        console.log('\x1b[1m\x1b[36m              EDBots Plugins               \x1b[0m');
        console.log('\x1b[1m\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');

        console.log(`  Total plugins: ${uniqueCommands.size}\n`);

        // Sort categories
        const sorted = Object.keys(categories).sort();
        sorted.forEach(cat => {
            const cmds = categories[cat];
            console.log(`\x1b[1m  ${cat.toUpperCase()}\x1b[0m (${cmds.length})`);
            cmds.forEach(cmd => {
                const vis = cmd.visibility === 'hidden' ? ' [hidden]' : 
                           cmd.visibility === 'private' ? ' [private]' : '';
                console.log(`    • ${cmd.name}${vis} - ${cmd.description || 'No description'}`);
            });
            console.log('');
        });
    } catch (err) {
        logger.error('Failed to load plugins:', err.message);
    }
}

async function plugins() {
    logger.banner();
    
    while (true) {
        console.log('\x1b[1m\x1b[36m━━━ EDBots Plugins ━━━\x1b[0m\n');
        console.log('  [1] List plugins');
        console.log('  [2] Back');
        console.log('');

        const choice = await ask('Select an option: ');

        switch (choice) {
            case '1':
                listPlugins();
                console.log('');
                break;
            case '2':
            case 'quit':
                close();
                return;
            default:
                logger.warn('Invalid option');
        }
    }
}

plugins().catch(err => {
    logger.error('Plugins error:', err.message);
    process.exit(1);
});
