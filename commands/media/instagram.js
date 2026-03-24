/**
 * Instagram Downloader (Placeholder)
 */

module.exports = {
  name: 'instagram',
  aliases: ['ig', 'igdl'],
  category: 'media',
  description: 'Download Instagram posts/reels',
  usage: '.ig <url>',
  execute: async (sock, msg, args, extra) => {
    // Disabled due to missing dependencies
    await extra.reply('⚠️ Instagram downloader is temporarily unavailable.');
  }
};
