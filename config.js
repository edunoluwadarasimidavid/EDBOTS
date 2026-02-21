/**
 * Global Configuration for WhatsApp MD Bot
 */

module.exports = {
    // Bot Owner Configuration
    ownerNumber: ['2349028375495','2349028375495'],
    ownerName: ['EDBOTS', 'Edun Oluwadarasimi David'],
    
    // Bot Configuration
    botName: 'EDBOTS',
    prefix: '.',
    sessionName: 'session', // Folder name for session data
    // sessionID removed - now managed in session/session_key.js
    newsletterJid: '120363161513685998@newsletter',
    updateZipUrl: 'https://github.com/edunoluwadarasimidavid/EDBOTS/archive/refs/heads/main.zip',
    
    // Sticker Configuration
    packname: 'EDBOTS',
    
    // Bot Behavior
    selfMode: false,
    autoRead: false,
    autoTyping: false,
    autoBio: false,
    autoSticker: false,
    autoReact: false,
    autoReactMode: 'bot',
    autoDownload: false,
    
    // Group Settings Defaults
    defaultGroupSettings: {
      antilink: false,
      antilinkAction: 'delete',
      antitag: false,
      antitagAction: 'delete',
      antiall: false,
      antiviewonce: false,
      antibot: false,
      anticall: false,
      antigroupmention: false,
      antigroupmentionAction: 'delete',
      welcome: true,
      welcomeMessage: '╭╼━≪•𝙽𝙴𝚆 𝙼𝙴𝙼𝙱𝙴𝚁•≫━╾╮\n┃𝚆𝙴𝙻𝙲𝙾𝙼𝙴: @user 👋\n┃Member count: #memberCount\n┃𝚃𝙸𝙼𝙴: time⏰\n╰━━━━━━━━━━━━━━━╯\n\n*@user* Welcome to *@group*! 🎉\n*Group 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽*\ngroupDesc\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ botName*',
      goodbye: false,
      goodbyeMessage: 'Goodbye @user 👋 We will never miss you!',
      antiSpam: false,
      antidelete: false,
      nsfw: false,
      detect: false,
      chatbot: false,
      autosticker: false
    },
    
    // API Keys
    apiKeys: {
      openai: '',
      deepai: '',
      remove_bg: 'Rz66NjLymx2ZY7YoUAuroGTM'
    },
    
    // Message Configuration
    messages: {
      wait: '⏳ Please wait...',
      success: '✅ Success!',
      error: '❌ Error occurred!',
      ownerOnly: '👑 This command is only for bot owner!',
      adminOnly: '🛡️ This command is only for group admins!',
      groupOnly: '👥 This command can only be used in groups!',
      privateOnly: '💬 This command can only be used in private chat!',
      botAdminNeeded: '🤖 Bot needs to be admin to execute this command!',
      invalidCommand: '❓ Invalid command! Type .menu for help'
    },
    
    timezone: 'Asia/Kolkata',
    maxWarnings: 3,
    
    social: {
      github: 'https://github.com/EDBOTS',
      instagram: 'https://instagram.com/edunoluwadarasimidavid',
      youtube: 'https://youtube.com/@edunoluwadarasimidavid?si=ZksmemM8EWFQsBbl'
    }
};
