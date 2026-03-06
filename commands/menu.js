module.exports = {
    name: 'menu',
    execute: async (sock, msg) => {
        const menuText = `
╔══════════════════════════════╗
║      *ED BOT COMMAND MENU*   ║
╚══════════════════════════════╝

*AI Commands*
• .edbot-ai question

*Owner Commands*
• .menu
• .help

*Group Management*
• .kick
• .promote
• .demote
• .mute
• .unmute

*Auto-Replies*
• Use keywords in private chat
        `.trim();
        
        await sock.sendMessage(msg.key.remoteJid, { text: menuText });
    }
};
