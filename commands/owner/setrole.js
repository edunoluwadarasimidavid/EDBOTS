const { setRole } = require('../../database');

module.exports = {
  name: 'setrole',
  category: 'owner',
  description: 'Assign role manually',
  usage: '.setrole @user role',
  isOwner: true,
  async handler({ args, reply, msg }) {
    let target = null;
    let role = null;

    if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
      target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
      role = args.slice(1).join(' ');
    } else {
      target = args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null;
      role = args.slice(1).join(' ');
    }

    if (!target || !role) return reply('❌ Usage: .setrole @user [role_name]');
    
    setRole(target, role);
    await reply(`✅ Role *${role}* assigned to ${target.split('@')[0]}.`);
  }
};