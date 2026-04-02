const { getGroupSettings, updateGroupSettings } = require('../../database');

module.exports = {
  name: 'antilink',
  category: 'admin',
  description: 'Toggle anti-link protection',
  usage: '.antilink [on/off]',
  isAdmin: true,
  isGroup: true,
  async handler({ args, from, reply }) {
    const settings = getGroupSettings(from);
    let newState;
    
    if (args[0] === 'on') newState = true;
    else if (args[0] === 'off') newState = false;
    else newState = !settings.antilink;

    updateGroupSettings(from, { antilink: newState });
    await reply(`🛡️ Anti-link protection is now *${newState ? 'ON' : 'OFF'}*.`);
  }
};