const fs = require('fs');
const path = require('path');

const MENU_PATH = path.join(__dirname, '..', '..', 'data', 'ownerMenu.json');

module.exports = {
    handleGreeting: async (sock, msg) => {
        let menuContent = "Hello 👋\n\nWelcome to ED BOT AI.\n\nAsk any question using:\n\nai: your question\n\nExample:\nai: what is programming\n\nCommands:\nmenu – show bot commands\nhelp – get help";
        
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
