const { removeRole } = require('../../database');

module.exports = {
  name: 'removerole',
  category: 'owner',
  description: 'Remove role manually',
  usage: '.removerole @user',
  isOwner: true,
  async handler({ args, reply, msg }) {
    let target = null;

    if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
      target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    } else {
      target = args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null;
    }

    if (!target) return reply('❌ Please mention a user or provide a phone number.');
    
    removeRole(target);
    await reply(`✅ Role removed from ${target.split('@')[0]}.`);
  }
};