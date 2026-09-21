/**
 * @file stop.js
 * @description EDBots stop command — graceful shutdown.
 */

'use strict';

const { execSync } = require('child_process');
const logger = require('../ui/logger');

/**
 * Find PIDs of running EDBots bot processes.
 *
 * `pgrep -f "node.*index.js"` also matches this CLI process, its shell
 * wrapper, and other `edbots <cmd>` invocations — so every candidate is
 * verified via its actual command line:
 *   - bot processes:      `node index.js` or `node .../src/cli/index.js start`
 *   - skipped:            `edbots stop/restart/status/...`, shells, wrappers
 */
function findBotPids() {
    let candidates = [];
    try {
        const result = execSync('pgrep -f "node.*index.js" 2>/dev/null || true', { encoding: 'utf8' });
        candidates = result
            .trim()
            .split('\n')
            .map(p => parseInt(p, 10))
            .filter(p => Number.isInteger(p) && p > 0)
            .filter(p => p !== process.pid && p !== process.ppid);
    } catch (e) {
        return [];
    }

    const botPids = [];
    for (const pid of candidates) {
        let cmd = '';
        try {
            cmd = execSync(`ps -p ${pid} -o args= 2>/dev/null`, { encoding: 'utf8' }).trim();
        } catch (e) {
            continue; // process vanished
        }
        if (!cmd) continue;

        // Skip anything that is the CLI invoked with a non-bot command
        // (e.g. `node src/cli/index.js stop`) — that's not the bot itself.
        const isCli = /cli[\/\\]index\.js/.test(cmd);
        const isCliBot = isCli && /\s(start|pair)\s*$/.test(cmd);
        if (isCli && !isCliBot) continue;

        // Skip shell/wrapper processes that merely mention the pattern
        if (/^(bash|sh|zsh|dash|timeout|sudo)\b/.test(cmd)) continue;

        botPids.push(pid);
    }
    return botPids;
}

function stop() {
    logger.info('Stopping EDBots...\n');

    const pids = findBotPids();

    if (pids.length === 0) {
        logger.warn('No running EDBots process found.');
        logger.info('EDBots is not currently running.');
        process.exit(0);
    }

    let stopped = 0;
    pids.forEach(pid => {
        try {
            process.kill(pid, 'SIGTERM');
            logger.info(`Sent SIGTERM to PID ${pid}`);
            stopped++;
        } catch (e) {
            // Process might already be dead — ignore
        }
    });

    if (stopped > 0) {
        // Wait a moment for graceful shutdown, then confirm
        setTimeout(() => {
            // Force-kill any survivors after grace period
            pids.forEach(pid => {
                try {
                    process.kill(pid, 0); // check existence
                    process.kill(pid, 'SIGKILL');
                    logger.warn(`Force-killed stubborn PID ${pid}`);
                } catch (e) { /* already gone */ }
            });
            logger.success('EDBots has been stopped.');
            process.exit(0);
        }, 2000);
    } else {
        logger.warn('Could not stop the bot (permission denied?).');
        process.exit(1);
    }
}

stop();
