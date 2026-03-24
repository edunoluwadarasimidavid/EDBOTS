/**
 * Take Command
 * Steal a sticker and re-pack with custom or user packname
 */

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { createStickerBuffer } = require('../../utils/sticker');
const config = require('../../config');

module.exports = {
  name: 'take',
  aliases: ['steal'],
  description: 'Steal a sticker and change its packname',
  usage: '.take [packname] (reply to sticker)',
  category: 'general',
  
  async execute(sock, msg, args, extra) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted || !quoted.stickerMessage) {
        return await extra.reply('🎭 Reply to a *sticker* to steal it.');
    }

    try {
        const buffer = await downloadMediaMessage(
            { message: quoted },
            'buffer',
            {},
            { logger: console, reuploadRequest: sock.updateMediaMessage }
        );

        const packname = args.length > 0 ? args.join(' ') : config.packname;
        const author = config.ownerName?.[0] || 'EDBOTS';

        // Re-create sticker with new metadata
        // Note: This re-encodes the sticker, which might affect quality slightly
        // but it removes the dependency on node-webpmux
        const stickerBuffer = await createStickerBuffer(buffer, {
            packname,
            author
        });

        await sock.sendMessage(extra.from, { sticker: stickerBuffer }, { quoted: msg });

    } catch (error) {
        console.error('Take error:', error);
        await extra.reply('❌ Failed to steal sticker.');
    }
  }
};
