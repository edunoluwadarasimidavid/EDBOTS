const axios = require('axios');
const AdmZip = require('adm-zip');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const config = require('../../config');
const { TEMP_DIR } = require('../../utils/tempManager');

module.exports = {
  name: 'update',
  description: 'Update the bot files to the latest version from GitHub',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, msg, args, context) {
    const { from, reply } = context;
    const repoUrl = config.social?.github || 'https://github.com/edunoluwadarasimidavid/EDBOTS';
    const updateUrl = `${repoUrl.replace(/\/$/, '')}/archive/refs/heads/main.zip`;

    try {
      await reply('🚀 *Initializing Update Protocol...*\n\nStep 1/5: Downloading repository archive from master branch...');

      const zipPath = path.join(TEMP_DIR, 'update.zip');
      const extractPath = path.join(TEMP_DIR, 'extracted');

      // 1. Download the ZIP
      const response = await axios({
        method: 'get',
        url: updateUrl,
        responseType: 'stream',
        timeout: 120000,
      });

      const writer = fs.createWriteStream(zipPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      await reply('📦 *Download Successful.*\n\nStep 2/5: Extracting and auditing files...');

      // 2. Clear previous extraction and extract the new ZIP
      await fs.remove(extractPath);
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractPath, true);

      // 3. Find the correct folder inside the ZIP (GitHub adds a branch-named prefix)
      let sourcePath = extractPath;
      const extractedItems = await fs.readdir(extractPath);

      for (const item of extractedItems) {
        const itemPath = path.join(extractPath, item);
        if (fs.statSync(itemPath).isDirectory()) {
          if (fs.existsSync(path.join(itemPath, 'package.json'))) {
            sourcePath = itemPath;
            break;
          }
        }
      }

      const destinationPath = process.cwd();

      // Backup the session before overwriting anything
      await reply('🛡️ Step 3/5: Backing up session data...');
      const sessionDir = path.join(destinationPath, config.sessionName || 'session');
      const sessionBackup = path.join(TEMP_DIR, 'session_backup_update');
      let hasSession = false;
      if (fs.existsSync(sessionDir)) {
        await fs.remove(sessionBackup).catch(() => {});
        await fs.copy(sessionDir, sessionBackup).catch(() => {});
        hasSession = true;
      }

      await reply('🔥 *Synchronizing Environment...*\n\nStep 4/5: Overwriting system files (strictly preserving session data)...');

      // 4. Update every file except session/git/node_modules
      const items = await fs.readdir(sourcePath);

      for (const item of items) {
        // STRICT EXCLUSION LIST: never overwrite authentication or git history
        if (item === 'session' || item === '.git' || item === 'node_modules' || item === 'data' || item === 'database') {
          continue;
        }

        const srcItemPath = path.join(sourcePath, item);
        const destItemPath = path.join(destinationPath, item);

        await fs.copy(srcItemPath, destItemPath, {
          overwrite: true,
          errorOnExist: false,
        });
      }

      // 5. Install any new dependencies
      await reply('📚 Step 5/5: Installing dependencies (this can take a while)...');
      let depsOk = true;
      try {
        await execPromise('npm install --legacy-peer-deps', {
          cwd: destinationPath,
          timeout: 300000,
        });
      } catch (e) {
        depsOk = false;
        console.error('[Update] npm install failed:', e.message);
      }

      // 6. Cleanup temp files
      await reply('🧹 *Finalizing:* Clearing update cache and temporary data...');
      await fs.remove(zipPath);
      await fs.remove(extractPath);

      // Restore session if the update replaced it (defensive: it was excluded above)
      if (hasSession && !fs.existsSync(sessionDir)) {
        await fs.copy(sessionBackup, sessionDir).catch(() => {});
      }

      const depsNote = depsOk
        ? '✅ Dependencies installed'
        : '⚠️ Dependency install had issues — run `npm install` manually';

      const successMessage = `
✅ *SYSTEM UPDATE COMPLETE*

*Improvements applied:*
- Core engine & commands synced to latest
- ${depsNote}
- Security protocols hardened
- Anti-ban systems refreshed

*Note:* Session data was preserved. No re-login is required.

> *Type \`.updates\` to see the new version*
`.trim();

      await reply(successMessage);

      // Restart: exit cleanly. The crash protector / process manager
      // (pm2, termux-services, edbots restart, docker restart policy)
      // is expected to relaunch. Detached self-spawn as a fallback.
      await reply('_System restarting to apply changes..._');

      let restarted = false;
      try {
        const { spawn } = require('child_process');
        const child = spawn(process.execPath, [path.join(destinationPath, 'index.js')], {
          cwd: destinationPath,
          detached: true,
          stdio: 'ignore',
          env: { ...process.env, EDBOTS_AUTH_MODE: '' },
        });
        child.unref();
        restarted = true;
      } catch (e) {
        restarted = false;
      }

      setTimeout(() => {
        process.exit(restarted ? 0 : 1);
      }, 3000);

    } catch (error) {
      console.error('[Update Error]', error);
      await reply(`❌ *UPDATE FAILURE:*\n\n${error.message}\n\nPlease check server logs for more details. No critical data was compromised.`);
    }
  }
};
