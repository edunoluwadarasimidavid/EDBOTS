const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const execPromise = util.promisify(exec);

// Get the project root directory (one level up from utils/)
const rootDir = path.resolve(__dirname, '..');

/**
 * Helper to run shell commands in the project root
 */
async function runGit(cmd) {
    try {
        const { stdout, stderr } = await execPromise(cmd, { cwd: rootDir });
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
 * Fetches the latest git tag from the repository.
 */
async function getLatestTag() {
    try {
        console.log('[VersionManager] Fetching latest tags from remote...');
        const fetchResult = await runGit('git fetch --tags --all');
        if (fetchResult.error) {
            console.warn('[VersionManager] Fetch warning (non-fatal):', fetchResult.stderr);
        }
        
        // Get the latest tag sorted by version (semver)
        let tagResult = await runGit('git tag -l --sort=-v:refname | head -n 1');
        
        if (!tagResult.stdout) {
            tagResult = await runGit('git tag -l --sort=-version:refname | head -n 1');
        }

        if (!tagResult.stdout) {
            tagResult = await runGit('git describe --tags $(git rev-list --tags --max-count=1)');
        }
        
        const finalTag = tagResult.stdout;
        console.log('[VersionManager] Detected latest tag:', finalTag || 'NONE');
        return finalTag || null;
    } catch (error) {
        console.error('[VersionManager] Unexpected Error in getLatestTag:', error);
        return null;
    }
}

/**
 * Forcefully resets local branch and checks out a specific tag.
 * This is "aggressive" to ensure the update actually happens even with local changes.
 */
async function resetToTag(tag) {
    try {
        console.log(`[VersionManager] Aggressively updating to tag: ${tag}`);
        
        // 1. Fetch tags again to be safe
        await runGit('git fetch --tags');
        
        // 2. Reset hard to ensure no local file conflicts block checkout
        // Warning: This clears all unsaved local changes to tracked files.
        await runGit('git reset --hard HEAD');
        
        // 3. Checkout the specific tag
        const result = await runGit(`git checkout ${tag}`);
        
        if (result.error) {
            console.error(`[VersionManager] Checkout Error:`, result.stderr);
            return false;
        }
        
        console.log('[VersionManager] Update successful');
        return true;
    } catch (error) {
        console.error(`[VersionManager] Unexpected Error in resetToTag:`, error);
        return false;
    }
}

/**
 * Gets current tag/version of the local repository.
 */
async function getCurrentTag() {
    try {
        const result = await runGit('git describe --tags --abbrev=0');
        return result.stdout || 'Unknown';
    } catch (e) {
        return 'Unknown';
    }
}

module.exports = { getLatestTag, resetToTag, getCurrentTag };
