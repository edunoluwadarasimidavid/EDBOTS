const fs = require('fs');
const path = require('path');
const config = require('../../config');

module.exports = {
  name: 'prefix',
  category: 'owner',
  description: 'Change the bot\'s prefix',
  usage: '.prefix <new_prefix>',
  ownerOnly: true,
  
  async execute(sock, msg, args, extra) {
    try {
      const newPrefix = args[0];
      
      // Validation
      if (!newPrefix) {
        return extra.reply('❌ Please provide a new prefix.');
      }
      
      if (newPrefix.length > 1 || /^[a-zA-Z0-9]+$/.test(newPrefix)) {
        return extra.reply('❌ Prefix must be a single special character (e.g., ., #, !, $).');
      }
      
      // Path to config.js
      const configPath = path.join(__dirname, '../../config.js');
      
      // Read config.js content
      let configContent = fs.readFileSync(configPath, 'utf-8');
      
      // Update the prefix using a regular expression to be safe
      const oldPrefix = config.prefix;
      const prefixRegex = new RegExp(`(prefix\s*:\s*['"\\])${oldPrefix}(['"\\])`);
      
      if (!prefixRegex.test(configContent)) {
          // Fallback if the regex fails for some reason
          return extra.reply('❌ Could not find the prefix in config.js. Please update it manually.');
      }
      
      configContent = configContent.replace(prefixRegex, `$1${newPrefix}$2`);
      
      // Write the updated content back to config.js
      fs.writeFileSync(configPath, configContent, 'utf-8');
      
      await extra.reply(`✅ Prefix updated to "${newPrefix}". The bot will now restart.`);
      
      // Restart the bot
      setTimeout(() => process.exit(0), 1000);
      
    } catch (error) {
      console.error('Error in prefix command:', error);
      await extra.reply('❌ An error occurred while updating the prefix.');
    }
  }
};
