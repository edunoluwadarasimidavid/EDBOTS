/**
 * TikTok Downloader - Modernized using tikwm API.
 * Removed ruhend-scraper.
 */

const axios = require('axios');
const APIs = require('../../utils/api');
const config = require('../../config');

module.exports = {
  name: 'tiktok',
  aliases: ['tt', 'ttdl', 'tiktokdl'],
  category: 'Media',
  description: 'Download TikTok videos',
  usage: '.tiktok <TikTok URL>',
  
  async execute(sock, msg, args, context) {
    const { from, reply } = context;
    try {
      let url = args[0] || (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation);
      
      if (!url) return reply('❌ Please provide a TikTok link.');
      
      reply('⏳ Downloading video...');
      
      const result = await APIs.getTikTokDownload(url);
      
      if (result && result.videoUrl) {
          await sock.sendMessage(from, {
              video: { url: result.videoUrl },
              mimetype: 'video/mp4',
              caption: `*${result.title || 'TikTok Video'}*\n\n> *DOWNLOADED BY ${config.botName.toUpperCase()}*`
          }, { quoted: msg });
      } else {
          reply('❌ Failed to retrieve download link.');
      }
      
    } catch (error) {
      console.error('TikTok command error:', error);
      reply('❌ Error: ' + error.message);
    }
  }
};
