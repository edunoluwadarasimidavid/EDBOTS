/**
 * @file crop.js
 * @description Advanced sticker cropping tool.
 */

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { createStickerBuffer } = require('../../utils/sticker');
const config = require('../../config');

module.exports = {
    name: "crop",
    aliases: ["scrop", "sticker-crop"],
    category: "general",
    description: "Convert image to cropped sticker",
    async execute(sock, msg, args, context) {
        const { from, reply } = context;

        // Check if message is image or reply to image
        const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
        const mime = q?.imageMessage?.mimetype || q?.videoMessage?.mimetype;

        if (!mime || !mime.startsWith('image')) {
            return reply('❌ Please reply to an image to crop it.');
        }

        try {
            reply(config.messages.wait || '⏳ Processing...');

            // Download media
            const buffer = await downloadMediaMessage(
                { message: q }, 
                'buffer', 
                {}, 
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );

            // Use internal util
            const stickerBuffer = await createStickerBuffer(buffer, {
                packname: config.packname || 'EDBOTS',
                author: config.ownerName?.[0] || 'Admin'
            });

            await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });

        } catch (error) {
            console.error('[CROP ERROR]', error);
            reply('❌ Failed to process sticker.');
        }
    }
};
