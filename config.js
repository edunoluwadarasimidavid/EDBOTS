/**
 * Global Configuration for WhatsApp MD Bot
 */

// Bot Owner Configuration
// Owner numbers come from the environment (never hardcoded for open source).
// OWNER_NUMBER is a comma-separated list of WhatsApp numbers that own the bot.
const envOwnerNumbers = (process.env.OWNER_NUMBER || '')
    .split(',')
    .map(n => n.trim())
    .filter(n => /^[0-9]{8,15}$/.test(n));

module.exports = {
    // Bot Owner Configuration
    owner: envOwnerNumbers.length > 0
        ? [...envOwnerNumbers, ...envOwnerNumbers]
        : ['', ''], // set OWNER_NUMBER=2348012345678 in .env
    ownerName: ['EDBOTS', 'Edun Oluwadarasimi David'],
    
    // Bot Configuration
    botName: 'EDBots',
    prefix: '.',
    sessionName: 'session', // Folder name for session data
    newsletterJid: '120363407258579577@newsletter',
    updateZipUrl: 'https://github.com/edunoluwadarasimidavid/EDBOTS/archive/refs/heads/main.zip',
    
    // Sticker Configuration
    packname: 'EDBots',
    
    // Bot Behavior
    selfMode: false,
    autoRead: false,
    autoTyping: false,
    autoBio: false,
    autoSticker: false,
    autoReact: false,
    autoReactMode: 'bot',
    autoDownload: false,
    autoReply: false,
    puterToken: '',
    
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
    
    // API Keys (loaded from environment — never hardcoded)
    apiKeys: {
      openai: process.env.OPENAI_API_KEY || '',
      deepai: process.env.DEEPAI_API_KEY || '',
      remove_bg: process.env.REMOVE_BG_API_KEY || ''
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
      github: 'https://github.com/edunoluwadarasimidavid/EDBOTS',
      instagram: 'https://instagram.com/edunoluwadarasimidavid',
      youtube: 'https://youtube.com/@edunoluwadarasimidavid?si=ZksmemM8EWFQsBbl'
    }
};
