const util = require('util');
const exec = util.promisify(require('child_process').exec);
const config = require('../../config');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');

const rootDir = path.join(__dirname, '..', '..');

module.exports = {
  name: 'update',
  description: 'Updates the bot from a remote zip file.',
  ownerOnly: true,
  category: 'owner',
  async execute(sock, msg, args, context) {
    try {
      await handleUpdate(sock, msg, context);
    } catch (e) {
      console.error('[Update Error]', e);
      await context.reply(`❌ Update failed: ${e.message}`);
    }
  },
};

async function handleUpdate(sock, msg, context) {
  await context.react('⏳');
  console.log('[Updater] Starting update from zip URL...');

  const zipUrl = config.updateZipUrl;
  if (!zipUrl) {
    return await context.reply('❌ Update URL is not configured.');
  }

  const tempZipPath = path.join(rootDir, 'update.zip');
  const tempExtractPath = path.join(rootDir, 'update_temp');

  try {
    // Download the zip file
    console.log(`[Updater] Downloading update from ${zipUrl}...`);
    const response = await axios({
      url: zipUrl,
      method: 'GET',
      responseType: 'stream',
    });

    const writer = require('fs').createWriteStream(tempZipPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log('[Updater] Download complete. Extracting...');

    // Extract the zip file
    await exec(`unzip -o "${tempZipPath}" -d "${tempExtractPath}"`, { cwd: rootDir });

    // Find the subdirectory inside the extracted folder
    const extractContents = await fs.readdir(tempExtractPath);
    const subDir = extractContents.find(item => item.startsWith('EDBOTS-main'));
    if (!subDir) {
      throw new Error('Could not find the main directory in the update zip.');
    }
    const sourceDir = path.join(tempExtractPath, subDir);

    // Move files to the root directory
    console.log(`[Updater] Moving files from ${sourceDir} to ${rootDir}...`);
    // Use shell command to move all files, including hidden ones
    await exec(`shopt -s dotglob && mv ${sourceDir}/* "${rootDir}"`);

    await context.reply('✅ Bot updated successfully! Restarting...');
    console.log('[Updater] Update complete. Restarting...');
    process.exit(1);

  } catch (error) {
    console.error('[Updater] An error occurred during the update process:', error);
    await context.reply(`❌ Update failed: ${error.message}`);
  } finally {
    // Cleanup temporary files and folders
    console.log('[Updater] Cleaning up temporary files...');
    try {
      await fs.unlink(tempZipPath);
    } catch (e) {
      // ignore
    }
    try {
      await fs.rm(tempExtractPath, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  }
}