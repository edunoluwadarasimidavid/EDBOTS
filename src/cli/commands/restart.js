/**
 * @file restart.js
 * @description EDBots restart command — graceful shutdown and restart.
 */

'use strict';

const { execSync, spawn } = require('child_process');
const logger = require('../ui/logger');

function restart() {
    logger.info('Restarting EDBots...\n');

    // Find and kill existing bot processes — excluding our own CLI process
    // (pgrep -f "node.*index.js" would otherwise match `node src/cli/index.js`
    // with a non-bot subcommand, and the shell wrapper that spawned us).
    try {
        const result = execSync('pgrep -f "node.*index.js" 2>/dev/null || true', { encoding: 'utf8' });
        const pids = result
            .trim()
            .split('\n')
            .map(p => parseInt(p, 10))
            .filter(p => Number.isInteger(p) && p > 0)
            .filter(p => p !== process.pid && p !== process.ppid);

        // Verify each candidate's actual command line before killing:
        // only real bot processes (`node index.js` or
        // `node .../cli/index.js start|pair`), not other edbots commands.
        const botPids = [];
        for (const pid of pids) {
            let cmd = '';
            try {
                cmd = execSync(`ps -p ${pid} -o args= 2>/dev/null`, { encoding: 'utf8' }).trim();
            } catch (e) { continue; }
            if (!cmd) continue;

            const isCli = /cli[\\/]index\.js/.test(cmd);
            const isCliBot = isCli && /\s(start|pair)\s*$/.test(cmd);
            if (isCli && !isCliBot) continue;
            if (/^(bash|sh|zsh|dash|timeout|sudo)\b/.test(cmd)) continue;

            botPids.push(pid);
        }

        if (botPids.length > 0) {
            botPids.forEach(pid => {
                try { process.kill(pid, 'SIGTERM'); } catch (e) { /* already dead */ }
            });
            logger.info(`Stopped ${botPids.length} running bot process(es).`);
            // Give the old process time to release the session lock
            require('child_process').execSync('sleep 1', { stdio: 'ignore' });
        } else {
            logger.info('No running bot process found.');
        }
    } catch (e) {
        // pgrep unavailable — continue
    }

    logger.info('Starting EDBots...\n');

    // Re-execute edbots start (spawns a child so output stays attached)
    const child = spawn(process.execPath, [require.resolve('./start')], {
        stdio: 'inherit',
        cwd: process.cwd(),
        detached: false,
    });

    child.on('exit', (code) => {
        process.exit(code || 0);
    });
}

restart();
