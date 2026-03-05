/**
 * Auto-reply Toggle Command
 * Enable or disable AI auto-reply
 */

const config = require('../../config');
const fs = require('fs');
const path = require('path');
const { authenticate, clearConnection } = require('../../utils/puterAI');

module.exports = {
  name: 'auto-reply',
  aliases: ['autoreply', 'ai-auto'],
  description: 'Enable/disable AI auto-reply for all messages',
  usage: '.auto-reply <on/off>',
  category: 'owner',
  ownerOnly: true,
  
  async execute(sock, msg, args, extra) {
    try {
      if (!args[0]) {
        return extra.reply(
          `🤖 *AI Auto Reply*\n\n` +
          `Status: *${config.autoReply ? 'ON' : 'OFF'}*\n\n` +
          `Usage:\n` +
          `  .auto-reply on - Enable auto-reply (Authenticates Puter AI)\n` +
          `  .auto-reply off - Disable auto-reply (Removes connection)`
        );
      }
      
      const toggle = args[0].toLowerCase();
      
      if (toggle === 'on') {
        if (config.autoReply) {
          return extra.reply('✅ AI Auto Reply is already *ON*.');
        }

        await extra.reply('🔑 Authenticating with Puter.js... Check your server terminal/browser if needed.');

        try {
          await authenticate();
          updateConfig('autoReply', true);
          config.autoReply = true;
          return extra.reply(
            `🌐 Your Puter AI account is now connected.\n` +
            `AI Auto Reply has been enabled.`
          );
        } catch (authError) {
          console.error('[AutoReply Auth Failure]', authError);
          return extra.reply(`❌ Authentication failed: ${authError.message}`);
        }
      }
      
      if (toggle === 'off') {
        if (!config.autoReply) {
          return extra.reply('❌ AI Auto Reply is already *OFF*.');
        }
        
        clearConnection();
        updateConfig('autoReply', false);
        config.autoReply = false;
        return extra.reply('❌ AI Auto Reply has been disabled and connection removed.');
      }
      
      return extra.reply('❌ Invalid argument!\nUsage: .auto-reply <on/off>');
      
    } catch (error) {
      console.error('Auto-reply command error:', error);
      await extra.reply('❌ Error toggling AI auto-reply.');
    }
  }
};

function updateConfig(key, value) {
  try {
    const configPath = path.join(__dirname, '..', '..', 'config.js');
    let configContent = fs.readFileSync(configPath, 'utf8');
    
    // Update the value
    const regex = new RegExp(`(${key}:\\s*)(true|false)`, 'g');
    configContent = configContent.replace(regex, `$1${value}`);
    
    fs.writeFileSync(configPath, configContent, 'utf8');
    
    // Reload config
    delete require.cache[require.resolve('../../config')];
  } catch (error) {
    console.error('Error saving config:', error);
  }
}
