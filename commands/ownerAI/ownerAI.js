const fs = require('fs');
const path = require('path');

const MENU_PATH = path.join(__dirname, '..', '..', 'data', 'ownerMenu.json');

module.exports = {
    handleGreeting: async (sock, msg) => {
        let menuContent = "Hello 👋

Welcome to ED BOT AI.

Ask any question using:

ai: your question

Example:
ai: what is programming

Commands:
menu – show bot commands
help – get help";
        
        try {
            if (fs.existsSync(MENU_PATH)) {
                const data = JSON.parse(fs.readFileSync(MENU_PATH, 'utf8'));
                if (data.menu) menuContent = data.menu;
            }
        } catch (error) {
            console.error('[OwnerAI] Menu loading error:', error);
        }

        await sock.sendMessage(msg.key.remoteJid, { text: menuContent });
    }
};
