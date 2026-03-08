const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Fetches the latest git tag from the repository.
 */
async function getLatestTag() {
    try {
        await execPromise('git fetch --tags');
        const { stdout } = await execPromise('git describe --tags $(git rev-list --tags --max-count=1)');
        return stdout.trim();
    } catch (error) {
        console.error('[VersionManager] Git Error:', error.message);
        return null;
    }
}

/**
 * Checks out a specific git tag.
 */
async function checkoutTag(tag) {
    try {
        await execPromise(`git checkout ${tag}`);
        return true;
    } catch (error) {
        console.error(`[VersionManager] Checkout Error: ${tag}`, error.message);
        return false;
    }
}

module.exports = { getLatestTag, checkoutTag };
