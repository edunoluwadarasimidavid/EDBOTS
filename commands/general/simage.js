/**
 * Sticker to Image/Video - Convert sticker to media
 */

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { webp2png, webp2mp4 } = require('../../utils/webp2mp4');

module.exports = {
  name: 'simage',
  aliases: ['toimg', 'stickertoimg', 'sticker2img', 'svideo'],
  category: 'general',
  description: 'Convert sticker to image (PNG) or video (MP4)',
  usage: '.simage (reply to sticker)',
  
  async execute(sock, msg, args, extra) {
    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quoted || !quoted.stickerMessage) {
        return await extra.reply('📎 Reply to a sticker!');
      }

      // Construct proper message object for download
      const target = { message: quoted };
      
      const buffer = await downloadMediaMessage(
        target,
        'buffer',
        {},
        { logger: console, reuploadRequest: sock.updateMediaMessage }
      );

      if (quoted.stickerMessage.isAnimated) {
        await extra.reply('⏳ Converting animated sticker...');
        const vid = await webp2mp4(buffer);
        await sock.sendMessage(extra.from, { 
            video: vid, 
            caption: 'Here is your video',
            gifPlayback: true 
        }, { quoted: msg });
      } else {
        await extra.reply('⏳ Converting sticker...');
        const img = await webp2png(buffer);
        await sock.sendMessage(extra.from, { 
            image: img, 
            caption: 'Here is your image' 
        }, { quoted: msg });
      }

    } catch (error) {
      console.error(error);
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
