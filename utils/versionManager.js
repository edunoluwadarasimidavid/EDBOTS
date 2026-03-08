const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Fetches the latest git tag from the repository.
 * Uses semver sorting to get the absolute latest.
 */
async function getLatestTag() {
    try {
        console.log('[VersionManager] Fetching latest tags...');
        await execPromise('git fetch --tags --all');
        
        // Get the latest tag sorted by version (semver)
        const { stdout } = await execPromise('git tag -l --sort=-v:refname | head -n 1');
        const tag = stdout.trim();
        
        if (!tag) {
            console.log('[VersionManager] No tags found, trying fallback method...');
            const { stdout: fallback } = await execPromise('git describe --tags $(git rev-list --tags --max-count=1)');
            return fallback.trim() || null;
        }
        
        return tag;
    } catch (error) {
        console.error('[VersionManager] Git Error fetching tag:', error.message);
        return null;
    }
}

/**
 * Checks out a specific git tag.
 * Handles potential conflicts by reporting status.
 */
async function checkoutTag(tag) {
    try {
        console.log(`[VersionManager] Checking out tag: ${tag}`);
        
        // Ensure we are in a clean state (optional: git reset --hard)
        // For safety, we just try to checkout first.
        const { stdout, stderr } = await execPromise(`git checkout ${tag}`);
        console.log('[VersionManager] Checkout output:', stdout || stderr);
        
        return true;
    } catch (error) {
        console.error(`[VersionManager] Checkout Error (${tag}):`, error.message);
        
        // If it failed due to local changes, we could try to stash them
        // But for now, we just return false and let the handler inform the user.
        return false;
    }
}

/**
 * Gets current tag/version of the local repository.
 */
async function getCurrentTag() {
    try {
        const { stdout } = await execPromise('git describe --tags --abbrev=0');
        return stdout.trim();
    } catch (e) {
        return 'Unknown';
    }
}

module.exports = { getLatestTag, checkoutTag, getCurrentTag };
