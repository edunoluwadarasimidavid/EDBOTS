/**
 * @file restart.js
 * @description EDBots restart command — graceful shutdown and restart.
 */

'use strict';

const { execSync } = require('child_process');
const logger = require('../ui/logger');

function restart() {
    logger.info('Restarting EDBots...\n');
    
    // Find and kill existing node process running index.js
    try {
        // On Linux/Mac
        execSync('pkill -f "node.*index.js" 2>/dev/null || true', { stdio: 'ignore' });
    } catch (e) {
        // Process might not exist
    }

    logger.info('Starting EDBots...');
    
    // Re-execute edbots start
    const { spawn } = require('child_process');
    const child = spawn(process.execPath, [require.resolve('./start')], {
        stdio: 'inherit',
        cwd: process.cwd(),
    });

    child.on('exit', (code) => {
        process.exit(code || 0);
    });
}

restart();
