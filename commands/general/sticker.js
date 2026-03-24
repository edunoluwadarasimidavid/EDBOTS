/**
 * Sticker Command
 * Uses ffmpeg + Jimp for processing. No sharp or node-webpmux.
 */

const fs = require('fs-extra');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const config = require('../../config');
const { writeExifImg, writeExifVid } = require('../../utils/exif');

module.exports = {
  name: 'sticker',
  aliases: ['s', 'stiker', 'stc'],
  description: 'Convert image or video to sticker',
  usage: '.sticker (reply to media)',
  category: 'general',
  
  async execute(sock, msg, args, context) {
    const { from, reply } = context;
    
    // Determine target message
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const target = quoted ? { message: quoted } : msg;
    
    const mediaType = target.message?.imageMessage ? 'image' : 
                      target.message?.videoMessage ? 'video' : null;
    
    if (!mediaType) {
      return reply('📎 Reply to an *image* or *video* to create a sticker.');
    }
    
    try {
      reply('⏳ Processing sticker...');
      
      const buffer = await downloadMediaMessage(
        target,
        'buffer',
        {},
        { logger: console, reuploadRequest: sock.updateMediaMessage },
      );
      
      if (!buffer) return reply('❌ Failed to download media.');

      let stickerBuffer;
      if (mediaType === 'image') {
          stickerBuffer = await writeExifImg(buffer, { packname: config.packname, author: config.ownerName?.[0] });
      } else {
          stickerBuffer = await writeExifVid(buffer, { packname: config.packname, author: config.ownerName?.[0] });
      }
      
      await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
      
    } catch (error) {
      console.error('Sticker command error:', error);
      reply('❌ Failed to create sticker.');
    }
  },
};
