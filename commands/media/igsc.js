module.exports = {
  name: 'igsc',
  category: 'media',
  description: 'Convert Instagram post/reel to cropped square sticker',
  execute: async (sock, msg, args, extra) => {
    await extra.reply('⚠️ Instagram Sticker Creator is temporarily unavailable.');
  }
};
