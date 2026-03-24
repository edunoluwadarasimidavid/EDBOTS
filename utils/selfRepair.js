/**
 * @file selfRepair.js
 * @description Advanced startup repair system for EDBOTS with Baileys peer dependency support.
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const SAFE_DEPS = [
  '@whiskeysockets/baileys',
  'jimp',
  'audio-decode',
  'link-preview-js',
  'pino',
  'axios',
  'fluent-ffmpeg',
  'fs-extra'
];

const DEPRECATED = ['node-webpmux', 'mumaker', 'ruhend-scraper', 'gifted-btns'];
const UNSUPPORTED_NATIVE = ['sharp'];

/**
 * Check and repair system.
 */
function selfRepair() {
    console.log('\n\x1b[34m[REPAIR] Starting Advanced System Repair (Peer-Dependency Optimized)...\x1b[0m');
    
    // 1. Cleanup old problematic files
    if (fs.existsSync('package-lock.json')) {
        console.log('\x1b[33m[REPAIR] Removing package-lock.json for clean resolution...\x1b[0m');
        fs.removeSync('package-lock.json');
    }

    // 2. Scan and fix package.json
    const pkg = fs.readJsonSync('package.json');
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    let repairNeeded = false;

    DEPRECATED.forEach(dep => {
        if (allDeps[dep]) {
            console.warn(`\x1b[31m[REPAIR] Removing deprecated package: ${dep}\x1b[0m`);
            delete pkg.dependencies[dep];
            repairNeeded = true;
        }
    });

    UNSUPPORTED_NATIVE.forEach(dep => {
        if (allDeps[dep]) {
            console.warn(`\x1b[31m[REPAIR] Removing unsupported native module: ${dep}\x1b[0m`);
            delete pkg.dependencies[dep];
            repairNeeded = true;
        }
    });

    // Ensure Baileys-compatible jimp version
    if (pkg.dependencies['jimp'] && !pkg.dependencies['jimp'].includes('1.6.0')) {
        console.log('\x1b[36m[REPAIR] Aligning jimp version to ^1.6.0 for Baileys compatibility.\x1b[0m');
        pkg.dependencies['jimp'] = '^1.6.0';
        repairNeeded = true;
    }

    if (repairNeeded) {
        fs.writeJsonSync('package.json', pkg, { spaces: 2 });
    }

    // 3. Verify System FFmpeg
    try {
        execSync('ffmpeg -version', { stdio: 'ignore' });
        console.log('\x1b[32m[REPAIR] System FFmpeg found.\x1b[0m');
    } catch (e) {
        console.warn('\x1b[31m[REPAIR] FFmpeg missing!\x1b[0m');
        const isTermux = process.platform === 'android';
        console.log(`\x1b[36m[TIP] Please install ffmpeg: ${isTermux ? 'pkg install ffmpeg -y' : 'sudo apt install ffmpeg -y'}\x1b[0m`);
    }

    // 4. Validate Missing Safe Dependencies
    const missing = [];
    SAFE_DEPS.forEach(dep => {
        try {
            require.resolve(dep);
        } catch (e) {
            missing.push(dep);
        }
    });

    if (missing.length > 0) {
        console.warn(`\x1b[33m[REPAIR] Missing dependencies detected: ${missing.join(', ')}\x1b[0m`);
        try {
            console.log('\x1b[36m[REPAIR] Running clean install with legacy-peer-deps...\x1b[0m');
            execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
        } catch (err) {
            console.error('\x1b[31m[REPAIR] Installation failed. Run npm install manually.\x1b[0m');
        }
    }

    console.log('\x1b[32m[REPAIR] System verification complete.\x1b[0m\n');
}

if (require.main === module) {
    selfRepair();
}

module.exports = { selfRepair };
