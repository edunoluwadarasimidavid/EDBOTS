/**
 * Facebook Downloader (Placeholder)
 */

module.exports = {
  name: 'facebook',
  aliases: ['fb', 'fbdl'],
  category: 'media',
  description: 'Download Facebook videos',
  usage: '.fb <url>',
  execute: async (sock, msg, args, extra) => {
    // Disabled due to missing dependencies
    await extra.reply('⚠️ Facebook downloader is temporarily unavailable.');
  }
};
