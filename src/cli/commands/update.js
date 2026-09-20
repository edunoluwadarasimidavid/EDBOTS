/**
 * @file update.js
 * @description EDBots update command — check and apply updates.
 *
 * Usage:
 *   edbots update             Check for updates
 *   edbots update --apply     Apply latest update
 *   edbots update --force     Force update even if up to date
 *
 * Works in BOTH environments:
 *   - Git clones:    git pull origin main + npm install
 *   - npm installs:  npm install -g edbots-md@latest
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../ui/logger');
const { askYesNo, close } = require('../ui/prompts');

const PACKAGE_NAME = require('../../../package.json').name; // edbots-md

const args = process.argv.slice(3);
const apply = args.includes('--apply');
const force = args.includes('--force');

/** Get the GitHub repo slug from git remote, or null if not a git repo. */
function getRepoSlug() {
    try {
        const url = execSync('git remote get-url origin', {
            encoding: 'utf8',
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        const m = url.match(/github\.com[:/](.+?)(?:\.git)?$/i);
        return m ? m[1] : null;
    } catch (e) {
        return null;
    }
}

async function fetchLatestRelease(slug) {
    const res = await fetch(`https://api.github.com/repos/${slug}/releases/latest`, {
        headers: { 'User-Agent': 'EDBots-CLI', Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json();
}

async function update() {
    logger.banner();
    logger.info('EDBots Update\n');

    // ── Current version ─────────────────────────────────────
    let currentVersion = 'unknown';
    let codename = '';
    try {
        const versionData = JSON.parse(
            fs.readFileSync(path.join(process.cwd(), 'bot_version.json'), 'utf8')
        );
        currentVersion = versionData.version || 'unknown';
        codename = versionData.codename || '';
    } catch (e) {
        logger.warn('Could not read bot_version.json');
    }

    // ── Environment detection ───────────────────────────────
    const repoSlug = getRepoSlug();
    const isGitRepo = !!repoSlug;
    const isNpmInstall = !isGitRepo;

    console.log(`  \x1b[1mCurrent version:\x1b[0m v${currentVersion}${codename ? ` (${codename})` : ''}`);
    console.log(`  \x1b[1mInstall type:\x1b[0m ${isNpmInstall ? 'npm (global/local)' : `git (${repoSlug})`}`);
    console.log('');

    // ── Check GitHub releases (best effort) ─────────────────
    logger.info('Checking for updates...');
    let latestVersion = null;
    let releaseNotes = '';
    let releaseUrl = '';

    if (!isNpmInstall) {
        try {
            const release = await fetchLatestRelease(repoSlug);
            if (release && release.tag_name) {
                latestVersion = (release.tag_name || '').replace(/^v/, '');
                releaseNotes = release.body || '';
                releaseUrl = release.html_url || '';
            }
        } catch (e) {
            logger.debug('GitHub releases not reachable, checking git...');
        }
    }

    // ── Git repos: fall back to commit comparison ───────────
    if (!isNpmInstall && !latestVersion) {
        try {
            execSync('git fetch origin', { cwd: process.cwd(), stdio: 'ignore', timeout: 15000 });
            const behind = execSync('git rev-list --count HEAD..origin/main', {
                encoding: 'utf8',
                cwd: process.cwd(),
                stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();

            if (parseInt(behind) > 0) {
                console.log('');
                logger.info(`\x1b[33m${behind} new commit(s) available on origin/main\x1b[0m`);

                if (apply || (await confirmUpdate())) {
                    await applyGitUpdate();
                } else {
                    logger.info('Update cancelled.');
                    logger.info('To update later: \x1b[36medbots update --apply\x1b[0m');
                }
                return;
            }

            console.log('');
            logger.success('You are up to date!');
            return;
        } catch (e) {
            console.log('');
            logger.warn('Could not reach GitHub. Check your internet connection.');
            return;
        }
    }

    // ── npm installs: compare against npm registry ──────────
    if (isNpmInstall) {
        let npmLatest = null;
        try {
            const res = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`, {
                headers: { 'User-Agent': 'EDBots-CLI' },
                signal: AbortSignal.timeout(10000),
            });
            if (res.ok) {
                const data = await res.json();
                npmLatest = data.version || null;
            }
        } catch (e) {
            // registry unreachable
        }

        if (npmLatest && compareVersions(npmLatest, currentVersion) > 0) {
            latestVersion = npmLatest;
        } else if (npmLatest) {
            console.log('');
            logger.success(`You are up to date! (v${currentVersion})`);
            return;
        } else {
            console.log('');
            logger.warn('Could not reach the npm registry. Check your internet connection.');
            return;
        }
    }

    // ── Compare versions ────────────────────────────────────
    const isNewer = compareVersions(latestVersion, currentVersion) > 0;

    if (!isNewer && !force) {
        console.log('');
        logger.success(`You are up to date! (v${currentVersion})`);
        return;
    }

    // ── Show update info ────────────────────────────────────
    console.log('');
    logger.info(`\x1b[33mUpdate available: v${currentVersion} → v${latestVersion}\x1b[0m`);

    if (releaseNotes) {
        console.log('\n  \x1b[1mWhat\'s new:\x1b[0m');
        releaseNotes.split('\n').slice(0, 10).forEach((line) => {
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

    // ── Apply ───────────────────────────────────────────────
    if (apply || (await confirmUpdate())) {
        if (isNpmInstall) {
            await applyNpmUpdate();
        } else {
            await applyGitUpdate();
        }
    } else {
        logger.info('Update cancelled.');
        logger.info('To apply later: \x1b[36medbots update --apply\x1b[0m');
    }
    close();
}

async function confirmUpdate() {
    try {
        return await askYesNo('\nApply this update now?', false);
    } catch (e) {
        return false;
    }
}

/** Update a git clone: stash → pull → npm install → unstash */
async function applyGitUpdate() {
    const { spinner } = require('../ui/spinner');
    const spin = spinner('Updating EDBots (git)');
    spin.start();

    try {
        const cwd = process.cwd();

        // Stash any local changes (preserve them)
        try {
            execSync('git stash', { cwd, stdio: 'ignore' });
        } catch (e) { /* nothing to stash */ }

        // Pull latest changes
        execSync('git pull origin main', { cwd, stdio: 'ignore', timeout: 60000 });

        // Install any new dependencies
        try {
            execSync('npm install --legacy-peer-deps', { cwd, stdio: 'ignore', timeout: 180000 });
        } catch (e) {
            logger.warn('Dependency install had issues (may still work)');
        }

        // Restore stashed changes if any
        try {
            execSync('git stash pop', { cwd, stdio: 'ignore' });
        } catch (e) { /* nothing stashed */ }

        spin.stop('Update applied successfully!');

        console.log('');
        logger.success('EDBots updated! 🎉');
        logger.info('');
        logger.info('Restart the bot to apply changes:');
        logger.info('  \x1b[36medbots restart\x1b[0m');
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

/** Update an npm install: npm install -g <pkg>@latest */
async function applyNpmUpdate() {
    const { spinner } = require('../ui/spinner');
    const spin = spinner('Updating EDBots via npm');
    spin.start();

    try {
        execSync(`npm install -g ${PACKAGE_NAME}@latest --legacy-peer-deps`, {
            stdio: 'ignore',
            timeout: 300000,
        });
        spin.stop('Update applied successfully!');

        console.log('');
        logger.success('EDBots updated! 🎉');
        logger.info('');
        logger.info('Restart the bot to apply changes:');
        logger.info('  \x1b[36medbots restart\x1b[0m');
        console.log('');
        process.exit(0);
    } catch (err) {
        spin.fail('Update failed');
        console.log('');
        logger.error(`Reason: ${err.message}`);
        console.log('');
        logger.info('Try manually (may need sudo/admin):');
        logger.info(`  \x1b[36mnpm install -g ${PACKAGE_NAME}@latest\x1b[0m`);
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

update().catch((err) => {
    logger.error('Update check failed:', err.message);
    logger.info('You can update manually with: \x1b[36mgit pull origin main\x1b[0m');
    process.exit(1);
});
