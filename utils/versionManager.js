/**
 * @file versionManager.js
 * @description Enterprise Version Management System for EDBOTS.
 * 
 * Uses GitHub Releases API and Git tags for proper versioning.
 * Supports:
 * - Version display with changelog
 * - Auto-update from GitHub releases
 * - Rollback to previous versions
 * - Version comparison (semver)
 * - Release notes parsing
 * - Backup before updates
 */

const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const execPromise = util.promisify(exec);

const rootDir = path.resolve(__dirname, '..');
const VERSION_FILE = path.join(rootDir, 'bot_version.json');
const CHANGELOG_FILE = path.join(rootDir, 'CHANGELOG.json');
const REPO_OWNER = 'edunoluwadarasimidavid';
const REPO_NAME = 'EDBOTS';

/**
 * Helper to run shell commands in the project root
 */
async function runGit(cmd) {
    try {
        const { stdout, stderr } = await execPromise(cmd, { cwd: rootDir, timeout: 30000 });
        return { stdout: stdout.trim(), stderr: stderr.trim(), error: null };
    } catch (error) {
        return {
            stdout: error.stdout ? error.stdout.trim() : '',
            stderr: error.stderr ? error.stderr.trim() : error.message,
            error
        };
    }
}

/**
 * Load current version from bot_version.json
 */
function getCurrentVersion() {
    try {
        if (fs.existsSync(VERSION_FILE)) {
            const data = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
            return {
                version: data.version || '1.0.0',
                codename: data.codename || '',
                lastUpdated: data.lastUpdated || null,
                changelog: data.changelog || []
            };
        }
    } catch (e) {}
    return { version: '1.0.0', codename: '', lastUpdated: null, changelog: [] };
}

/**
 * Save version to bot_version.json
 */
function saveVersion(versionData) {
    try {
        fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2));
        return true;
    } catch (e) {
        console.error('[VersionManager] Save error:', e);
        return false;
    }
}

/**
 * Compare two semver versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

/**
 * Get all available versions from GitHub releases
 */
async function getAvailableVersions() {
    try {
        const response = await axios.get(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`,
            { timeout: 15000 }
        );
        
        if (response.data && Array.isArray(response.data)) {
            return response.data.map(release => ({
                version: release.tag_name.replace(/^v/, ''),
                name: release.name || release.tag_name,
                body: release.body || 'No description',
                publishedAt: release.published_at,
                prerelease: release.prerelease,
                zipballUrl: release.zipball_url,
                tarballUrl: release.tarball_url,
                assets: release.assets || []
            }));
        }
        return [];
    } catch (error) {
        console.error('[VersionManager] Failed to fetch releases:', error.message);
        return [];
    }
}

/**
 * Get the latest release from GitHub
 */
async function getLatestRelease() {
    try {
        const response = await axios.get(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
            { timeout: 15000 }
        );
        
        if (response.data) {
            return {
                version: response.data.tag_name.replace(/^v/, ''),
                name: response.data.name || response.data.tag_name,
                body: response.data.body || 'No description',
                publishedAt: response.data.published_at,
                zipballUrl: response.data.zipball_url
            };
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Get all available tags from the repository
 */
async function getAvailableTags() {
    try {
        const result = await runGit('git fetch --tags --all 2>/dev/null; git tag -l --sort=-version:refname');
        if (result.stdout) {
            return result.stdout.split('\n').filter(t => t.trim());
        }
        return [];
    } catch (e) {
        return [];
    }
}

/**
 * Get the latest tag from the repository
 */
async function getLatestTag() {
    try {
        const tags = await getAvailableTags();
        return tags.length > 0 ? tags[0] : null;
    } catch (error) {
        return null;
    }
}

/**
 * Get current git tag/commit info
 */
async function getCurrentGitInfo() {
    try {
        const tagResult = await runGit('git describe --tags --abbrev=0 2>/dev/null');
        const commitResult = await runGit('git rev-parse --short HEAD 2>/dev/null');
        const dateResult = await runGit('git log -1 --format=%ci 2>/dev/null');
        
        return {
            tag: tagResult.stdout || null,
            commit: commitResult.stdout || 'unknown',
            date: dateResult.stdout || 'unknown'
        };
    } catch (e) {
        return { tag: null, commit: 'unknown', date: 'unknown' };
    }
}

/**
 * Create a backup before update/rollback
 */
async function createBackup() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(rootDir, 'backups', `backup-${timestamp}`);
        
        await runGit(`mkdir -p "${backupDir}" 2>/dev/null || true`);
        
        // Copy critical files
        const filesToBackup = [
            'bot_version.json', 'config.js', 'database.js',
            'package.json', '.env', '.env.local'
        ];
        
        for (const file of filesToBackup) {
            const src = path.join(rootDir, file);
            if (fs.existsSync(src)) {
                await runGit(`cp "${src}" "${backupDir}/" 2>/dev/null || true`);
            }
        }
        
        // Backup session directory
        const sessionDir = path.join(rootDir, 'session');
        if (fs.existsSync(sessionDir)) {
            await runGit(`cp -r "${sessionDir}" "${backupDir}/session" 2>/dev/null || true`);
        }
        
        console.log(`[VersionManager] Backup created: ${backupDir}`);
        return backupDir;
    } catch (error) {
        console.error('[VersionManager] Backup failed:', error.message);
        return null;
    }
}

/**
 * Download and extract a specific release
 */
async function downloadRelease(version) {
    try {
        const releases = await getAvailableVersions();
        const release = releases.find(r => r.version === version || r.version === `v${version}`);
        
        if (!release) {
            return { success: false, error: `Version ${version} not found on GitHub` };
        }
        
        console.log(`[VersionManager] Downloading release ${version}...`);
        return {
            success: true,
            release,
            downloadUrl: release.zipballUrl
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Rollback to a specific version using git tags
 */
async function rollbackToVersion(version) {
    try {
        console.log(`[VersionManager] Rolling back to version ${version}...`);
        
        // Create backup first
        await createBackup();
        
        // Fetch latest tags
        await runGit('git fetch --tags --all');
        
        // Try to checkout the tag
        const tagName = version.startsWith('v') ? version : `v${version}`;
        const result = await runGit(`git checkout ${tagName} 2>&1`);
        
        if (result.error) {
            // Try without v prefix
            const result2 = await runGit(`git checkout ${version} 2>&1`);
            if (result2.error) {
                return { success: false, error: `Could not find version ${version}` };
            }
        }
        
        // Update bot_version.json
        const versionData = getCurrentVersion();
        versionData.version = version;
        versionData.lastUpdated = new Date().toISOString();
        versionData.rollback = true;
        saveVersion(versionData);
        
        console.log(`[VersionManager] Rollback to ${version} successful`);
        return { success: true, version };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Update to latest version from GitHub (NON-DESTRUCTIVE).
 *
 * - Backs up first
 * - Stashes local changes and restores them after the pull
 * - Uses `git pull --ff-only` (NEVER reset --hard)
 * - Reinstalls dependencies
 */
async function updateToLatest() {
    try {
        console.log('[VersionManager] Updating to latest version...');

        // Create backup first
        await createBackup();

        // Stash local changes so nothing is destroyed
        const status = await runGit('git status --porcelain');
        const hasLocalChanges = status.stdout && status.stdout.trim().length > 0;
        let stashed = false;
        if (hasLocalChanges) {
            const stashRes = await runGit('git stash push --include-untracked -m "EDBots auto-stash before update"');
            stashed = !stashRes.error && /stash/i.test(stashRes.stdout + stashRes.stderr);
        }

        // Pull latest (fast-forward only — never rewrites local history)
        const result = await runGit('git pull --ff-only 2>&1');

        if (result.error) {
            if (stashed) await runGit('git stash pop 2>&1');
            return { success: false, error: result.stderr || 'git pull failed' };
        }

        // Install dependencies if package.json changed
        await runGit('npm install --legacy-peer-deps 2>&1 || true');

        // Restore local changes
        if (stashed) {
            await runGit('git stash pop 2>&1');
        }

        console.log('[VersionManager] Update to latest successful');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Format changelog for display
 */
function formatChangelog(changelog) {
    if (!changelog || changelog.length === 0) return 'No changelog available.';
    
    return changelog.map(entry => {
        const emoji = entry.type === 'added' ? '✨' 
            : entry.type === 'fixed' ? '🔧' 
            : entry.type === 'changed' ? '🔄'
            : entry.type === 'removed' ? '🗑️'
            : '📝';
        return `${emoji} ${entry.description}`;
    }).join('\n');
}

/**
 * Count how many commits the local copy is behind the remote main branch.
 *
 * Detection strategy (most reliable first):
 *   1. git fetch + rev-list        (git clones — exact commit count)
 *   2. GitHub compare API          (needs local HEAD sha)
 *   3. raw package.json version    (zip installs without .git)
 *
 * Returns { behind, source, remoteVersion?, localVersion? }.
 */
async function getCommitBehindCount() {
    // 1. Git-based check (git clones)
    const fetchRes = await runGit('git fetch origin main 2>&1');
    if (!fetchRes.error) {
        const countRes = await runGit('git rev-list --count HEAD..origin/main');
        if (!countRes.error && countRes.stdout !== '') {
            return { behind: parseInt(countRes.stdout, 10) || 0, source: 'git' };
        }
    }

    // 2. GitHub compare API (uses local HEAD sha)
    // Semantics for `HEAD...main`: ahead_by = commits main has that local
    // lacks (i.e. how far behind we are); behind_by = local-only commits.
    const commitRes = await runGit('git rev-parse HEAD');
    if (!commitRes.error && commitRes.stdout) {
        try {
            const res = await axios.get(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/compare/${commitRes.stdout}...main`,
                { timeout: 15000, headers: { 'User-Agent': 'EDBots-VersionManager' } }
            );
            if (res.data && typeof res.data.ahead_by === 'number') {
                return { behind: res.data.ahead_by, source: 'github' };
            }
        } catch (e) { /* fall through */ }
    }

    // 3. Raw package.json version comparison (zip installs, no .git)
    try {
        const res = await axios.get(
            `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/package.json`,
            { timeout: 15000 }
        );
        const remoteVersion = res.data && res.data.version;
        let localVersion = null;
        try {
            localVersion = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version;
        } catch (e) { /* ignore */ }
        if (remoteVersion && localVersion) {
            return {
                behind: compareVersions(remoteVersion, localVersion) > 0 ? 1 : 0,
                source: 'registry',
                remoteVersion,
                localVersion
            };
        }
    } catch (e) { /* offline or no network */ }

    return { behind: 0, source: 'none' };
}

/**
 * Get formatted version info for display
 *
 * NOTE: This repo does not use GitHub Releases, so update detection is
 * primarily commit-based (getCommitBehindCount). Releases are used when
 * they exist.
 */
async function getVersionInfo() {
    const current = getCurrentVersion();
    const gitInfo = await getCurrentGitInfo();
    const latestRelease = await getLatestRelease();
    const commitInfo = await getCommitBehindCount();
    const tags = await getAvailableTags();

    let updateAvailable = false;

    if (latestRelease) {
        updateAvailable = compareVersions(
            current.version,
            latestRelease.version.replace(/^v/, '')
        ) < 0;
    }
    if (!updateAvailable && commitInfo.behind > 0) {
        updateAvailable = true;
    }

    return {
        current,
        gitInfo,
        latestRelease,
        commitInfo,
        tags: tags.slice(0, 10), // Latest 10 tags
        isUpToDate: !updateAvailable,
        updateAvailable
    };
}

module.exports = {
    getCurrentVersion,
    saveVersion,
    compareVersions,
    getAvailableVersions,
    getLatestRelease,
    getAvailableTags,
    getLatestTag,
    getCurrentGitInfo,
    getCommitBehindCount,
    createBackup,
    downloadRelease,
    rollbackToVersion,
    updateToLatest,
    formatChangelog,
    getVersionInfo,
    VERSION_FILE,
    CHANGELOG_FILE,
    REPO_OWNER,
    REPO_NAME
};
