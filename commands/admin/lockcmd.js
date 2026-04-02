const { disableCmd } = require('../../database');

module.exports = {
  name: 'lockcmd',
  category: 'admin',
  description: 'Lock command in current group',
  usage: '.lockcmd [command_name]',
  isAdmin: true,
  isGroup: true,
  async handler({ args, from, reply }) {
    if (!args[0]) return reply('❌ Please provide a command name.');
    const cmdName = args[0].toLowerCase();
    
    if (cmdName === 'lockcmd' || cmdName === 'unlockcmd') {
      return reply('❌ You cannot lock critical management commands.');
    }

    disableCmd(from, cmdName);
    await reply(`🔒 Command *${cmdName}* has been locked in this group.`);
  }
};