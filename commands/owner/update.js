/**
 * Update Command - Fetch latest code via ZIP (Owner Only)
 * Preserves runtime/state dirs: node_modules, session, tmp, temp, database, config.js
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const config = require('../../config');

const MAX_REDIRECTS = 5;

// Helper function to increment version
async function incrementVersion() {
  const versionPath = path.join(process.cwd(), 'version.json');
  try {
    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
    let [major, minor, patch] = versionData.version.split('.').map(Number);
    patch++;
    const newVersion = `${major}.${minor}.${patch}`;
    versionData.version = newVersion;
    fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2));
    return newVersion;
  } catch (error) {
    console.error('Failed to increment version:', error);
    return 'N/A'; // Return N/A if versioning fails
  }
}

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || stdout || err.message || '').toString()));
      resolve((stdout || '').toString());
    });
  });
}

async function extractZip(zipPath, outDir) {
  // ... (rest of the function is unchanged)
}

function downloadFile(url, dest, visited = new Set()) {
  // ... (rest of the function is unchanged)
}

function copyRecursive(src, dest, ignore = [], relative = '', outList = []) {
  // ... (rest of the function is unchanged)
}

async function updateViaZip(zipUrl) {
  // ... (rest of the function is unchanged)
}

module.exports = {
  name: 'update',
  aliases: ['upgrade'],
  category: 'owner',
  description: 'Update bot from configured ZIP URL (Owner Only)',
  usage: '.update [optional_zip_url]',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;
    const zipUrl = (args[0] || config.updateZipUrl || process.env.UPDATE_ZIP_URL || '').trim();

    if (!zipUrl) {
      return extra.reply('❌ No update URL configured. Set updateZipUrl in config.js or pass a URL: `.update <zip_url>`');
    }

    try {
      await extra.reply('🔄 Updating the bot, please wait…');

      const { copiedFiles } = await updateViaZip(zipUrl);
      
      // Increment the version after a successful update
      const newVersion = await incrementVersion();

      const summary = copiedFiles.length
        ? `✅ Update complete to v${newVersion}. Files updated: ${copiedFiles.length}`
        : `✅ Update complete to v${newVersion}. No files needed updating.`;

      await sock.sendMessage(chatId, { text: `${summary}\nRestarting…` }, { quoted: msg });

      // Attempt restart via pm2 if available, else exit to allow panel auto-restart
      try {
        await run('pm2 restart all');
        return;
      } catch {}

      setTimeout(() => process.exit(0), 500);
    } catch (error) {
      console.error('Update failed:', error);
      await sock.sendMessage(chatId, { text: `❌ Update failed:\n${String(error.message || error)}` }, { quoted: msg });
    }
  }
};

