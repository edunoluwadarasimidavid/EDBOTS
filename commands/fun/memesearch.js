/**
 * Meme Search Command - Search and get memes
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { getTempDir, deleteTempFile } = require('../../utils/tempManager');

// Use public API instead of the broken one if possible, but for now just fixing the ffmpeg part
const BASE = 'https://api.shizo.top/tools/meme-search';

module.exports = {
  name: 'memesearch',
  aliases: ['memes', 'sm', 'smeme', 'gifsearch', 'gif'],
  category: 'fun',
  desc: 'Search and get memes',
  usage: 'memesearch <query>',
  execute: async (sock, msg, args, extra) => {
    try {
      const query = args.join(' ').trim();
      
      if (!query) {
        return await extra.reply('Usage: .memesearch <query>');
      }
      
      const url = `${BASE}?apikey=shizo&query=${encodeURIComponent(query)}`;
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      const mediaBuffer = Buffer.from(response.data);
      if (!mediaBuffer.length) throw new Error('Empty response');
      
      // Send as document if it's a GIF to avoid complex conversion for now
      // or send as video if compatible
      const isGif = response.headers['content-type']?.includes('gif');
      
      if (isGif) {
          await sock.sendMessage(extra.from, { 
              video: mediaBuffer, 
              gifPlayback: true,
              caption: `Meme: ${query}`
          }, { quoted: msg });
      } else {
          await sock.sendMessage(extra.from, { 
              image: mediaBuffer, 
              caption: `Meme: ${query}`
          }, { quoted: msg });
      }

    } catch (error) {
      await extra.reply(`❌ Failed to fetch meme: ${error.message}`);
    }
  }
};
