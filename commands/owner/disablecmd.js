const { disableCmd } = require('../../database');

module.exports = {
  name: 'disablecmd',
  category: 'owner',
  description: 'Disable command in current group',
  usage: '.disablecmd [command_name]',
  isOwner: true,
  isGroup: true,
  async handler({ args, from, reply }) {
    if (!args[0]) return reply('❌ Please provide a command name.');
    const cmdName = args[0].toLowerCase();
    
    if (cmdName === 'disablecmd' || cmdName === 'enablecmd' || cmdName === 'security') {
      return reply('❌ You cannot disable critical security commands.');
    }

    disableCmd(from, cmdName);
    await reply(`✅ Command *${cmdName}* has been disabled in this group.`);
  }
};