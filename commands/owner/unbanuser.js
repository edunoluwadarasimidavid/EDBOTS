const { unbanUser } = require('../../database');

module.exports = {
  name: 'unbanuser',
  category: 'owner',
  description: 'Remove global ban from user',
  usage: '.unbanuser @user/number',
  isOwner: true,
  async handler({ args, reply, msg }) {
    let target = args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null;
    if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
      target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    } else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
      target = msg.message.extendedTextMessage.contextInfo.participant;
    }

    if (!target) return reply('❌ Please mention a user or provide a phone number.');
    
    const success = unbanUser(target);
    if (success) {
      await reply(`✅ User ${target.split('@')[0]} has been unbanned.`);
    } else {
      await reply('❌ User is not banned or an error occurred.');
    }
  }
};