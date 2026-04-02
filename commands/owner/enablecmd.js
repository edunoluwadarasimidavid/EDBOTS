const { enableCmd } = require('../../database');

module.exports = {
  name: 'enablecmd',
  category: 'owner',
  description: 'Enable command in current group',
  usage: '.enablecmd [command_name]',
  isOwner: true,
  isGroup: true,
  async handler({ args, from, reply }) {
    if (!args[0]) return reply('❌ Please provide a command name.');
    const cmdName = args[0].toLowerCase();
    
    enableCmd(from, cmdName);
    await reply(`✅ Command *${cmdName}* has been enabled in this group.`);
  }
};