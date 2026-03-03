/**
 * Translate Command - Translate text to different languages
 */

const APIs = require('../../utils/api'); // Import the centralized API functions

module.exports = {
  name: 'translate',
  aliases: ['trt', 'tr'],
  category: 'utility',
  description: 'Translate text to different languages',
  usage: '.translate <text> <lang> or .translate <lang> (reply to message)',
  
  async execute(sock, msg, args) {
    try {
      const chatId = msg.key.remoteJid;
      
      // Show typing indicator
      await sock.sendPresenceUpdate('composing', chatId);
      
      let textToTranslate = '';
      let lang = '';
      
      // Check if it's a reply
      const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      
      if (quotedMessage) {
        // Get text from quoted message
        textToTranslate = quotedMessage.conversation || 
                         quotedMessage.extendedTextMessage?.text || 
                         quotedMessage.imageMessage?.caption || 
                         quotedMessage.videoMessage?.caption || 
                         '';
        
        // Get language from command
        lang = args.join(' ').trim();
      } else {
        // Parse command arguments for direct message
        if (args.length < 2) {
          return await sock.sendMessage(chatId, {
            text: `*TRANSLATOR*\n\n` +
            `Usage:\n` +
            `1. Reply to a message with: .translate <lang> or .trt <lang>\n` +
            `2. Or type: .translate <text> <lang> or .trt <text> <lang>\n\n` +
            `Example:\n` +
            `.translate hello fr\n` +
            `.trt hello fr\n\n` +
            `Language codes:\n` +
            `en - English, es - Spanish, fr - French, de - German, it - Italian,\n` +
            `pt - Portuguese, ru - Russian, ja - Japanese, ko - Korean, zh - Chinese,\n` +
            `ar - Arabic, hi - Hindi, id - Indonesian, ms - Malay, tl - Tagalog` // Added more common languages
          }, { quoted: msg });
        }
        
        lang = args.pop(); // Get language code
        textToTranslate = args.join(' '); // Get text to translate
      }
      
      if (!textToTranslate) {
        return await sock.sendMessage(chatId, { 
          text: '❌ No text found to translate. Please provide text or reply to a message.' 
        }, { quoted: msg });
      }
      
      if (!lang) {
        return await sock.sendMessage(chatId, { 
          text: '❌ Please specify a language code.\n\nExample: .translate hello fr' 
        }, { quoted: msg });
      }
      
      // Use the centralized translation API
      const result = await APIs.translate(textToTranslate, lang);
      
      if (!result || !result.translation) {
        return await sock.sendMessage(chatId, { 
          text: '❌ Failed to translate text. Please try again later.' 
        }, { quoted: msg });
      }
      
      // Send translation
      await sock.sendMessage(chatId, {
        text: `🌐 *Translation*\n\n` +
              `📝 Original: ${textToTranslate}\n` +
              `🔤 Translated: ${result.translation}\n` +
              `🌍 Language: ${lang.toUpperCase()}`
      }, { quoted: msg });
      
    } catch (error) {
      console.error('❌ Error in translate command:', error);
      await sock.sendMessage(msg.key.remoteJid, { 
        text: `❌ Translation failed! Error: ${error.message}` 
      }, { quoted: msg });
    }
  }
};
