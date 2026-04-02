const { getGroupSettings, updateGroupSettings } = require('../../database');

module.exports = {
  name: 'antispam',
  category: 'admin',
  description: 'Toggle anti-spam protection',
  usage: '.antispam [on/off]',
  isAdmin: true,
  isGroup: true,
  async handler({ args, from, reply }) {
    const settings = getGroupSettings(from);
    let newState;
    
    if (args[0] === 'on') newState = true;
    else if (args[0] === 'off') newState = false;
    else newState = !settings.antiSpam;

    updateGroupSettings(from, { antiSpam: newState });
    await reply(`🛡️ Anti-spam protection is now *${newState ? 'ON' : 'OFF'}*.`);
  }
};