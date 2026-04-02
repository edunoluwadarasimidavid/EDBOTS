const { enableCmd } = require('../../database');

module.exports = {
  name: 'unlockcmd',
  category: 'admin',
  description: 'Unlock command in current group',
  usage: '.unlockcmd [command_name]',
  isAdmin: true,
  isGroup: true,
  async handler({ args, from, reply }) {
    if (!args[0]) return reply('❌ Please provide a command name.');
    const cmdName = args[0].toLowerCase();
    
    enableCmd(from, cmdName);
    await reply(`🔓 Command *${cmdName}* has been unlocked in this group.`);
  }
};