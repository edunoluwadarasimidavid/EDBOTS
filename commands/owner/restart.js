/**
 * Restart Command - Restart bot (Owner Only)
 */

const { exec } = require('child_process');
const { setRestartFlag } = require('../../utils/restartManager');

module.exports = {
  name: 'restart',
  aliases: ['reboot', 'reload'],
  category: 'owner',
  description: 'Restart the bot (Owner Only)',
  usage: '.restart',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const chatId = msg.key.remoteJid;
      await extra.reply('🔁 *Restarting bot...*');

      // Set flag so we can notify the owner after restart
      await setRestartFlag(chatId);

      const run = (cmd) =>
        new Promise((resolve, reject) => {
          exec(cmd, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout || stderr);
          });
        });

      try {
        // If running under PM2, this will restart it
        await run('pm2 restart all');
        return;
      } catch (e) {
        console.log('[SYSTEM] PM2 not available, falling back to process.exit');
      }

      // For panels, heroku, & nodemon – they usually restart on exit
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    } catch (error) {
      console.error('Restart error:', error);
      await extra.reply(`❌ Error restarting bot: ${error.message}`);
    }
  },
};
