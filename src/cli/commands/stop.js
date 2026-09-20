/**
 * @file stop.js
 * @description EDBots stop command — graceful shutdown.
 */

'use strict';

const { execSync } = require('child_process');
const logger = require('../ui/logger');

function stop() {
    logger.info('Stopping EDBots...\n');
    
    let stopped = false;
    
    try {
        // Try to find and kill the bot process
        const result = execSync('pgrep -f "node.*index.js" 2>/dev/null || true', { encoding: 'utf8' });
        const pids = result.trim().split('\n').filter(p => p.trim());
        
        if (pids.length > 0) {
            pids.forEach(pid => {
                try {
                    process.kill(parseInt(pid), 'SIGTERM');
                    logger.info(`Sent SIGTERM to PID ${pid}`);
                    stopped = true;
                } catch (e) {
                    // Process might already be dead
                }
            });
            
            // Wait a moment for graceful shutdown
            setTimeout(() => {
                logger.success('EDBots has been stopped.');
                process.exit(0);
            }, 2000);
        } else {
            logger.warn('No running EDBots process found.');
        }
    } catch (e) {
        logger.warn('Could not find running process.');
    }
    
    if (!stopped) {
        logger.info('EDBots is not currently running.');
    }
}

stop();
