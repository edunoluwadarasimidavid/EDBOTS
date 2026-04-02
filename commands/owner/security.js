const { isBanned, isDisabled } = require('../../database');

module.exports = {
  name: 'security',
  category: 'owner',
  description: 'Show security system status',
  usage: '.security',
  isOwner: true,
  async handler({ reply }) {
    const status = `╭╼━≪• 𝚂𝙴𝙲𝚄𝚁𝙸𝚃𝚈 𝚂𝚈𝚂𝚃𝙴𝙼 •≫━╾╮
┃ 🛡️ Owner Protection: ACTIVE
┃ 👮 Admin Protection: ACTIVE
┃ 👥 Group Protection: ACTIVE
┃ 🚫 Ban System: ACTIVE
┃ 🚷 Disabled Commands: ACTIVE
┃ 📝 Security Logging: ACTIVE
╰━━━━━━━━━━━━━━━╯`;
    await reply(status);
  }
};