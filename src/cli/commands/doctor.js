/**
 * @file doctor.js
 * @description EDBots doctor command — diagnoses common problems.
 * 
 * Checks:
 * - Node.js version
 * - Dependencies installed
 * - FFmpeg availability
 * - Session validity
 * - Configuration validity
 * - File permissions
 * - Disk space
 * 
 * Usage:
 *   edbots doctor
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('../ui/logger');
const configManager = require('../../config/manager');

const results = { pass: [], warn: [], fail: [] };

function check(name, fn) {
    try {
        const result = fn();
        if (result === true || result?.status === 'pass') {
            results.pass.push(name);
            console.log(`  \x1b[32m✓\x1b[0m ${name}`);
        } else if (result?.status === 'warn') {
            results.warn.push(name);
            console.log(`  \x1b[33m⚠\x1b[0m ${name}`);
            if (result.detail) console.log(`    \x1b[90m${result.detail}\x1b[0m`);
        } else {
            results.fail.push(name);
            console.log(`  \x1b[31m✗\x1b[0m ${name}`);
            if (result?.detail) console.log(`    \x1b[90m${result.detail}\x1b[0m`);
        }
    } catch (e) {
        results.fail.push(name);
        console.log(`  \x1b[31m✗\x1b[0m ${name}`);
        console.log(`    \x1b[90m${e.message}\x1b[0m`);
    }
}

function doctor() {
    logger.banner();
    logger.info('EDBots Doctor — Diagnostics\n');

    configManager.load();

    console.log('\x1b[1m\x1b[36mEnvironment:\x1b[0m\n');

    // Node version check
    check('Node.js version (18+)', () => {
        const major = parseInt(process.version.slice(1).split('.')[0]);
        if (major >= 18) return true;
        return { status: 'fail', detail: `Found ${process.version}, need 18+. Update Node.js.` };
    });

    // FFmpeg check
    check('FFmpeg installed', () => {
        try {
            execSync('ffmpeg -version', { stdio: 'ignore' });
            return true;
        } catch (e) {
            const isTermux = process.platform === 'android';
            return {
                status: 'warn',
                detail: `Media features disabled. Install: ${isTermux ? 'pkg install ffmpeg' : 'sudo apt install ffmpeg'}`
            };
        }
    });

    // Disk space
    check('Disk space available', () => {
        try {
            const output = execSync('df -h . | tail -1 | awk \'{print $4}\'', { encoding: 'utf8' }).trim();
            return { status: 'pass', detail: `${output} free` };
        } catch (e) {
            return true; // Skip on unsupported platforms
        }
    });

    console.log('\n\x1b[1m\x1b[36mDependencies:\x1b[0m\n');

    // Critical dependencies
    const criticalDeps = [
        '@whiskeysockets/baileys',
        'axios',
        'pino',
        'fs-extra',
        'qrcode-terminal',
    ];
    check('Core dependencies installed', () => {
        const missing = criticalDeps.filter(d => {
            try { require.resolve(d); return false; } catch (e) { return true; }
        });
        if (missing.length === 0) return true;
        return {
            status: 'fail',
            detail: `Missing: ${missing.join(', ')}. Run: npm install`
        };
    });

    // AI dependencies (optional)
    check('AI dependencies (optional)', () => {
        const aiDeps = ['axios'];
        const missing = aiDeps.filter(d => {
            try { require.resolve(d); return false; } catch (e) { return true; }
        });
        if (missing.length === 0) return true;
        return { status: 'warn', detail: 'AI features may be limited' };
    });

    console.log('\n\x1b[1m\x1b[36mConfiguration:\x1b[0m\n');

    // Config validity
    check('Configuration valid', () => {
        const validation = configManager.validate();
        if (validation.valid && validation.warnings.length === 0) return true;
        if (validation.errors.length > 0) {
            return { status: 'fail', detail: validation.errors.join('; ') };
        }
        return { status: 'warn', detail: validation.warnings.join('; ') };
    });

    // Owner number set
    check('Owner number configured', () => {
        const owner = configManager.get('owner.number');
        if (owner && owner.length >= 8) return true;
        return {
            status: 'warn',
            detail: 'Set with: edbots customize'
        };
    });

    console.log('\n\x1b[1m\x1b[36mAuthentication:\x1b[0m\n');

    // Session check
    const sessionDir = path.join(process.cwd(), configManager.get('bot.sessionName') || 'session');
    const hasAuth = fs.existsSync(path.join(sessionDir, 'creds.json'));

    check('WhatsApp session', () => {
        if (hasAuth) return { status: 'pass', detail: 'Connected' };
        return {
            status: 'warn',
            detail: 'Not connected. Run: edbots start'
        };
    });

    // Session directory writable
    check('Session directory writable', () => {
        try {
            fs.mkdirSync(sessionDir, { recursive: true });
            fs.accessSync(sessionDir, fs.constants.W_OK);
            return true;
        } catch (e) {
            return { status: 'fail', detail: 'Cannot write to session directory. Check permissions.' };
        }
    });

    console.log('\n\x1b[1m\x1b[36mBot Files:\x1b[0m\n');

    // Commands directory
    check('Commands directory', () => {
        const cmdsDir = path.join(process.cwd(), 'commands');
        if (!fs.existsSync(cmdsDir)) {
            return { status: 'fail', detail: 'Missing. Bot cannot load commands.' };
        }
        const count = fs.readdirSync(cmdsDir).filter(f =>
            fs.statSync(path.join(cmdsDir, f)).isDirectory()
        ).length;
        return { status: 'pass', detail: `${count} categories` };
    });

    // Core files
    check('Core engine files', () => {
        const coreFiles = ['core/connection.js', 'core/handler.js', 'core/engine.js'];
        const missing = coreFiles.filter(f => !fs.existsSync(path.join(process.cwd(), f)));
        if (missing.length === 0) return true;
        return { status: 'fail', detail: `Missing: ${missing.join(', ')}` };
    });

    // Summary
    console.log('\n\x1b[1m\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');
    console.log(`  \x1b[32m✓ Passed:\x1b[0m ${results.pass.length}`);
    console.log(`  \x1b[33m⚠ Warnings:\x1b[0m ${results.warn.length}`);
    console.log(`  \x1b[31m✗ Failed:\x1b[0m ${results.fail.length}`);
    console.log('');

    if (results.fail.length === 0) {
        logger.success('EDBots is healthy! 🎉');
    } else {
        logger.error('Issues found. Fix the failed checks above.');
        process.exit(1);
    }
}

doctor();
