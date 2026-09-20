/**
 * @file update.js
 * @description EDBots update command — check and apply updates.
 * 
 * Usage:
 *   edbots update             Check for updates
 *   edbots update --apply     Apply latest update from GitHub
 *   edbots update --force     Force update even if up to date
 */

'use strict';

const { execSync } = require('child_process');
const logger = require('../ui/logger');
const { askYesNo, close } = require('../ui/prompts');

const args = process.argv.slice(3);
const apply = args.includes('--apply');
const force = args.includes('--force');

async function update() {
    logger.banner();
    logger.info('EDBots Update\n');

    // Load current version from bot_version.json
    let currentVersion = 'unknown';
    let codename = '';
    try {
        const versionData = require('../../../bot_version.json');
        currentVersion = versionData.version || 'unknown';
        codename = versionData.codename || '';
    } catch (e) {
        logger.warn('Could not read bot_version.json');
    }

    // Get git info
    let commit = 'unknown';
    let branch = 'unknown';
    try {
        commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8', cwd: process.cwd() }).trim();
        branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', cwd: process.cwd() }).trim();
    } catch (e) {
        // Not a git repo or git not available
    }

    console.log(`  \x1b[1mCurrent version:\x1b[0m v${currentVersion}${codename ? ` (${codename})` : ''}`);
    if (commit !== 'unknown') {
        console.log(`  \x1b[1mGit commit:\x1b[0m ${commit} (${branch})`);
    }
    console.log('');

    // Check for updates from GitHub releases API
    logger.info('Checking for updates...');
    let latestVersion = null;
    let releaseNotes = '';
    let releaseUrl = '';

    try {
        const axios = require('axios');
        const res = await axios.get(
            'https://api.github.com/repos/edunoluwadarasimidavid/EDBOTS/releases/latest',
            { timeout: 10000, headers: { 'User-Agent': 'EDBots-CLI' } }
        );
        if (res.data) {
            latestVersion = (res.data.tag_name || '').replace(/^v/, '');
            releaseNotes = res.data.body || '';
            releaseUrl = res.data.html_url || '';
        }
    } catch (e) {
        // GitHub API unavailable or no releases — fall back to git
        logger.debug('GitHub releases not available, checking git...');
    }

    // Git-based check as fallback
    if (!latestVersion) {
        try {
            execSync('git fetch origin 2>/dev/null', { cwd: process.cwd(), stdio: 'ignore' });
            const behind = execSync(
                'git rev-list --count HEAD..origin/main 2>/dev/null || echo 0',
                { encoding: 'utf8', cwd: process.cwd() }
            ).trim();

            if (parseInt(behind) > 0) {
                console.log('');
                logger.info(`\x1b[33m${behind} new commit(s) available on origin/main\x1b[0m`);

                if (apply || await confirmUpdate()) {
                    await applyGitUpdate();
                } else {
                    logger.info('Update cancelled.');
                    logger.info('To update later: \x1b[36medbots update --apply\x1b[0m');
                }
                return;
            }
        } catch (e) {
            // Git check unavailable
        }

        console.log('');
        logger.success('You are up to date! (could not reach GitHub releases)');
        return;
    }

    // Compare versions
    const isNewer = compareVersions(latestVersion, currentVersion) > 0;

    if (!isNewer && !force) {
        console.log('');
        logger.success(`You are up to date! (v${currentVersion})`);
        return;
    }

    // Show update info
    console.log('');
    logger.info(`\x1b[33mUpdate available: v${currentVersion} → v${latestVersion}\x1b[0m`);

    if (releaseNotes) {
        console.log('\n  \x1b[1mWhat\'s new:\x1b[0m');
        releaseNotes.split('\n').slice(0, 10).forEach(line => {
            if (line.trim()) console.log(`    ${line.substring(0, 80)}`);
        });
        if (releaseNotes.split('\n').length > 10) {
            console.log('    ...');
        }
    }

    if (releaseUrl) {
        console.log(`\n  \x1b[90mRelease: ${releaseUrl}\x1b[0m`);
    }

    console.log('');

    // Apply or ask
    if (apply) {
        await applyGitUpdate();
    } else {
        const confirmed = await confirmUpdate();
        close();
        if (confirmed) {
            await applyGitUpdate();
        } else {
            logger.info('Update cancelled.');
            logger.info('To apply later: \x1b[36medbots update --apply\x1b[0m');
        }
    }
}

async function confirmUpdate() {
    try {
        return await askYesNo('\nApply this update now?', false);
    } catch (e) {
        return false;
    }
}

async function applyGitUpdate() {
    const { spinner } = require('../ui/spinner');
    const spin = spinner('Updating EDBots');
    spin.start();

    try {
        const cwd = process.cwd();

        // Stash any local changes (preserve them)
        try {
            execSync('git stash', { cwd, stdio: 'ignore' });
        } catch (e) {}

        // Pull latest changes
        execSync('git pull origin main', { cwd, stdio: 'ignore' });

        // Install any new dependencies
        try {
            execSync('npm install --legacy-peer-deps', { cwd, stdio: 'ignore', timeout: 120000 });
        } catch (e) {
            logger.warn('Dependency install had issues (may still work)');
        }

        // Restore stashed changes if any
        try {
            execSync('git stash pop', { cwd, stdio: 'ignore' });
        } catch (e) {}

        spin.stop('Update applied successfully!');

        console.log('');
        logger.success('EDBots updated! 🎉');
        logger.info('');
        logger.info('Restart the bot to apply changes:');
        logger.info('  \x1b[36medbots restart\x1b[0m');
        logger.info('  or: \x1b[36medbots start\x1b[0m');
        console.log('');

        process.exit(0);
    } catch (err) {
        spin.fail('Update failed');
        console.log('');
        logger.error(`Reason: ${err.message}`);
        console.log('');
        logger.info('Possible fixes:');
        logger.info('  1. Check your internet connection');
        logger.info('  2. Ensure git is installed');
        logger.info('  3. Try manually: \x1b[36mgit pull origin main\x1b[0m');
        console.log('');
        process.exit(1);
    }
}

function compareVersions(a, b) {
    if (a === b) return 0;
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

update().catch(err => {
    logger.error('Update check failed:', err.message);
    logger.info('You can update manually with: \x1b[36mgit pull origin main\x1b[0m');
    process.exit(1);
});
