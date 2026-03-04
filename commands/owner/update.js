const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');

const REPO_OWNER = 'edunoluwadarasimidavid';
const REPO_NAME = 'EDBOTS';

module.exports = {
    name: 'update',
    description: 'Automatically updates the bot to the latest Git tag.',
    ownerOnly: true,
    category: 'owner',
    async execute(sock, msg, args, context) {
        const { reply, react } = context;
        const rootDir = path.resolve(__dirname, '..', '..');
        const tempZipPath = path.join(rootDir, 'update.zip');
        const tempExtractPath = path.join(rootDir, 'update_temp');
        const versionFilePath = path.join(rootDir, 'bot_version.json');

        try {
            await react('⏳');
            await reply('🔍 Checking for updates...');

            // 1. Get Latest Tag
            console.log('[Updater] Fetching latest tag from GitHub...');
            let latestTag = '';
            let zipUrl = '';

            try {
                // Try fetching releases first
                const releaseUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
                const releaseRes = await axios.get(releaseUrl, { headers: { 'User-Agent': 'EDBOTS-Updater' } });
                latestTag = releaseRes.data.tag_name;
                zipUrl = releaseRes.data.zipball_url;
            } catch (e) {
                // Fallback to tags if no releases found
                console.log('[Updater] No releases found, checking tags...');
                const tagsUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/tags`;
                const tagsRes = await axios.get(tagsUrl, { headers: { 'User-Agent': 'EDBOTS-Updater' } });
                if (tagsRes.data.length > 0) {
                    latestTag = tagsRes.data[0].name;
                    zipUrl = tagsRes.data[0].zipball_url;
                }
            }

            if (!latestTag || !zipUrl) {
                throw new Error('Could not find any tags or releases for this repository.');
            }

            console.log(`[Updater] Found latest tag: ${latestTag}`);
            await reply(`📥 Downloading update: ${latestTag}...`);

            // 2. Download Zip
            console.log(`[Updater] Downloading zip from ${zipUrl}...`);
            const response = await axios({
                url: zipUrl,
                method: 'GET',
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'EDBOTS-Updater' }
            });

            fs.writeFileSync(tempZipPath, response.data);
            console.log('[Updater] Download complete.');

            // 3. Extract Zip
            console.log('[Updater] Extracting...');
            const zip = new AdmZip(tempZipPath);
            zip.extractAllTo(tempExtractPath, true);

            // 4. Move Files
            // GitHub zips usually extract to a folder like 'Repo-Name-Ref', so we find that first
            const extractedFolders = fs.readdirSync(tempExtractPath);
            const sourceFolder = path.join(tempExtractPath, extractedFolders[0]); // The single folder inside zip

            console.log(`[Updater] Moving files from ${sourceFolder} to ${rootDir}...`);
            await moveFilesRecursive(sourceFolder, rootDir);

            // 5. Update bot_version.json
            console.log(`[Updater] Updating version file to ${latestTag}...`);
            const versionData = { version: latestTag };
            fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2));

            // 6. Cleanup
            console.log('[Updater] Cleaning up temporary files...');
            try {
                fs.unlinkSync(tempZipPath);
                fs.rmSync(tempExtractPath, { recursive: true, force: true });
            } catch (cleanupErr) {
                console.error('[Updater] Cleanup warning:', cleanupErr.message);
            }

            console.log('[Updater] Update finished successfully.');
            await reply(`✅ Update to *${latestTag}* successful! Restarting bot...`);
            
            // Restart
            setTimeout(() => {
                process.exit(0);
            }, 1000);

        } catch (error) {
            console.error('[Updater] Update failed:', error);
            await reply(`❌ Update failed: ${error.message}`);
            // Attempt cleanup on fail
            if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
            if (fs.existsSync(tempExtractPath)) fs.rmSync(tempExtractPath, { recursive: true, force: true });
        }
    }
};

/**
 * recursively moves files from src to dest
 * Overwrites existing files, preserves hidden files
 * Skips specific protected paths
 */
async function moveFilesRecursive(src, dest) {
    const stats = fs.statSync(src);
    const isDirectory = stats.isDirectory();

    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        }

        const files = fs.readdirSync(src);
        for (const file of files) {
            const srcPath = path.join(src, file);
            const destPath = path.join(dest, file);

            // PROTECTED PATHS/FILES TO SKIP
            if (
                file === 'node_modules' || 
                file === 'session' || 
                file === 'database' ||
                file === '.git' || 
                file === '.env' || 
                file === 'index.js' || 
                file === 'handler.js' || 
                file === 'config.js'
            ) {
                console.log(`[Updater] Skipping protected path: ${file}`);
                continue;
            }

            await moveFilesRecursive(srcPath, destPath);
        }
    } else {
        // It's a file, copy and overwrite
        try {
            // We use copy + unlink instead of rename to handle cross-device links if temp is on diff partition
            fs.copyFileSync(src, dest);
            // We don't delete source here immediately to keep logic simple, 
            // the whole temp dir is deleted at the end.
        } catch (err) {
            console.error(`[Updater] Error moving file ${src} to ${dest}:`, err.message);
            throw err;
        }
    }
}
