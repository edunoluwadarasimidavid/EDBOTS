module.exports = {
  name: 'igs',
  aliases: ['igstory'],
  category: 'media',
  description: 'Download Instagram Stories',
  usage: '.igs <username>',
  execute: async (sock, msg, args, extra) => {
    await extra.reply('⚠️ Instagram Story downloader is temporarily unavailable.');
  }
};
