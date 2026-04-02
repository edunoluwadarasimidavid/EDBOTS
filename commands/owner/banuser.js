const { banUser } = require('../../database');

module.exports = {
  name: 'banuser',
  category: 'owner',
  description: 'Ban user globally',
  usage: '.banuser @user/number',
  isOwner: true,
  async handler({ args, reply, msg }) {
    let target = args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null;
    if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
      target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    } else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
      target = msg.message.extendedTextMessage.contextInfo.participant;
    }

    if (!target) return reply('❌ Please mention a user or provide a phone number.');
    
    const success = banUser(target);
    if (success) {
      await reply(`✅ User ${target.split('@')[0]} has been banned globally.`);
    } else {
      await reply('❌ User is already banned or an error occurred.');
    }
  }
};