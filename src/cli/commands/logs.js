/**
 * @file logs.js
 * @description EDBots logs viewing command.
 * 
 * Usage:
 *   edbots logs          Show recent logs
 *   edbots logs --follow Follow logs in real-time
 */

'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../ui/logger');

const args = process.argv.slice(3);
const follow = args.includes('--follow') || args.includes('-f');

function showLogs() {
    const logFiles = [
        path.join(process.cwd(), 'bot.log'),
        path.join(process.cwd(), 'logs', 'bot.log'),
        path.join(process.cwd(), 'output.log'),
    ];

    let logFile = null;
    for (const f of logFiles) {
        if (fs.existsSync(f)) {
            logFile = f;
            break;
        }
    }

    if (!logFile) {
        logger.info('No log file found. Logs are output to the console when the bot runs.');
        logger.info('');
        logger.info('To see live logs, start the bot in the foreground:');
        logger.info('  edbots start');
        return;
    }

    if (follow) {
        logger.info(`Following logs from: ${path.basename(logFile)}`);
        logger.info('Press Ctrl+C to stop\n');
        
        const { spawn } = require('child_process');
        const tail = spawn('tail', ['-f', '-n', '50', logFile]);
        
        tail.stdout.pipe(process.stdout);
        tail.stderr.pipe(process.stderr);
        
        process.on('SIGINT', () => {
            tail.kill();
            process.exit(0);
        });
    } else {
        // Show last 50 lines
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter(l => l.trim()).slice(-50);
        
        console.log('\x1b[1m\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
        console.log(`\x1b[1m  EDBots Logs — Last ${lines.length} lines\x1b[0m`);
        console.log('\x1b[1m\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');
        
        lines.forEach(line => {
            // Colorize based on level
            if (line.includes('[ERROR]') || line.includes('error')) {
                console.log(`\x1b[31m${line}\x1b[0m`);
            } else if (line.includes('[WARN]') || line.includes('warn')) {
                console.log(`\x1b[33m${line}\x1b[0m`);
            } else if (line.includes('[SUCCESS]') || line.includes('success')) {
                console.log(`\x1b[32m${line}\x1b[0m`);
            } else {
                console.log(line);
            }
        });
        console.log('');
    }
}

showLogs();
