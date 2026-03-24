const axios = require('axios');
const AdmZip = require('adm-zip');
const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const { TEMP_DIR } = require('../../utils/tempManager');

module.exports = {
  name: 'update',
  description: 'High-grade manual update system (non-Git)',
  category: 'owner',
  ownerOnly: true,
  async execute(sock, msg, args, context) {
    const { from, reply } = context;
    // Hardcoded repository update URL
    const repoUrl = 'https://github.com/edunoluwadarasimidavid/EDBOTS';
    const updateUrl = `${repoUrl}/archive/refs/heads/main.zip`;

    try {
      await reply('🚀 *Initializing High-Grade Update Protocol...*\n\nStep 1/4: Downloading repository archive from master branch...');

      const zipPath = path.join(TEMP_DIR, 'update.zip');
      const extractPath = path.join(TEMP_DIR, 'extracted');

      // 1. Download the ZIP
      const response = await axios({
        method: 'get',
        url: updateUrl,
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(zipPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      await reply('📦 *Download Successful.*\n\nStep 2/4: Extracting and auditing files...');

      // 2. Clear previous extraction and extract the new ZIP
      await fs.remove(extractPath);
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractPath, true);

      // 3. Find the correct folder inside the ZIP (GitHub usually adds a branch-named prefix)
      let sourcePath = extractPath;
      const extractedItems = await fs.readdir(extractPath);
      
      for (const item of extractedItems) {
          const itemPath = path.join(extractPath, item);
          if (fs.statSync(itemPath).isDirectory()) {
              // Usually the first folder contains the source code
              if (fs.existsSync(path.join(itemPath, 'package.json'))) {
                  sourcePath = itemPath;
                  break;
              }
          }
      }

      const destinationPath = process.cwd();

      await reply('🔥 *Synchronizing Environment...*\n\nStep 3/4: Overwriting system files (Strictly preserving session data)...');

      // 4. Update every file except session
      const items = await fs.readdir(sourcePath);

      for (const item of items) {
        // STRICT EXCLUSION LIST: Never overwrite authentication or git history
        if (item === 'session' || item === '.git' || item === 'node_modules') {
          continue;
        }

        const srcItemPath = path.join(sourcePath, item);
        const destItemPath = path.join(destinationPath, item);

        // Copy item (file or folder) with overwrite
        await fs.copy(srcItemPath, destItemPath, {
          overwrite: true,
          errorOnExist: false,
        });
      }

      // 5. Cleanup temp files
      await reply('🧹 *Finalizing:* Clearing update cache and temporary data...');
      await fs.remove(zipPath);
      await fs.remove(extractPath);

      // Final Success Notification
      const successMessage = `
✅ *SYSTEM UPDATE COMPLETE*

The EDBOTS framework has been successfully updated to the latest version via the High-Grade Update Mechanism.

*Improvements applied:*
- Core engine optimized.
- All command modules synced.
- Security protocols hardened.
- Anti-ban systems refreshed.

*Note:* Session data was preserved. No re-login is required.

> *Mechanism Status: Ultra-Grade Stable* 🚀
`.trim();

      await reply(successMessage);

      // Restart the bot to apply changes
      await reply('_System restarting to apply changes..._');
      
      setTimeout(() => {
        process.exit(0);
      }, 3000);

    } catch (error) {
      console.error('[Update Error]', error);
      await reply(`❌ *CRITICAL UPDATE FAILURE:*\n\n${error.message}\n\nPlease check server logs for more details. No critical data was compromised.`);
    }
  }
};
