const config = require('../config');
const os = require('os');

module.exports = {
    name: 'menu',
    execute: async (sock, msg) => {
        const prefix = config.prefix || '.';
        const botName = config.botName || 'EDBOTS';
        const pushName = msg.pushName || 'User';
        
        // Calculate Uptime (optional, for aesthetics)
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        const menuText = `
╭─╼─≪ *${botName.toUpperCase()}* ≫─╼─╮
│ 🤖 *User:* ${pushName}
│ ⏱️ *Uptime:* ${hours}h ${minutes}m
│ 👑 *Prefix:* [ ${prefix} ]
╰╼━━━━━━━━━━━━━━━╾╯

╭╼━≪ 🧠 *AI & AUTOMATION* ≫━╾╮
┃ • \`${prefix}edbot-ai\` - Group AI
┃ • \`ai:\` - Private AI Assistant
┃ • \`${prefix}auto-reply\` - Connect Puter
┃ • \`${prefix}magicstudio\` - AI Image
┃ • _Auto-keywords active_ 🔑
╰━━━━━━━━━━━━━━━╯

╭╼━≪ 🛡️ *ADMINISTRATION* ≫━╾╮
┃ • \`${prefix}kick\` | \`${prefix}promote\`
┃ • \`${prefix}mute\` | \`${prefix}unmute\`
┃ • \`${prefix}hidetag\` | \`${prefix}tagall\`
┃ • \`${prefix}antilink\` | \`${prefix}antitag\`
┃ • \`${prefix}welcome\` | \`${prefix}goodbye\`
╰━━━━━━━━━━━━━━━╯

╭╼━≪ 🎮 *ENTERTAINMENT* ≫━╾╮
┃ • \`${prefix}joke\` | \`${prefix}meme\` | \`${prefix}ship\`
┃ • \`${prefix}dare\` | \`${prefix}truth\` | \`${prefix}gayrate\`
┃ • \`${prefix}waifu\` | \`${prefix}neko\` | \`${prefix}loli\`
╰━━━━━━━━━━━━━━━╯

╭╼━≪ 📥 *DOWNLOADER* ≫━╾╮
┃ • \`${prefix}song\` | \`${prefix}video\` | \`${prefix}lyrics\`
┃ • \`${prefix}tiktok\` | \`${prefix}ig\` | \`${prefix}fb\`
┃ • \`${prefix}ytsearch\` | \`${prefix}play\`
╰━━━━━━━━━━━━━━━╯

╭╼━≪ 🎨 *TEXT & MEDIA* ≫━╾╮
┃ • \`${prefix}sticker\` | \`${prefix}attp\` | \`${prefix}tts\`
┃ • \`${prefix}carbon\` | \`${prefix}neon\` | \`${prefix}fire\`
┃ • \`${prefix}glitch\` | \`${prefix}devil\` | \`${prefix}snow\`
╰━━━━━━━━━━━━━━━╯

╭╼━≪ 🛠️ *UTILITIES* ≫━╾╮
┃ • \`${prefix}weather\` | \`${prefix}translate\`
┃ • \`${prefix}calc\` | \`${prefix}ssweb\` | \`${prefix}qr\`
┃ • \`${prefix}ping\` | \`${prefix}uptime\` | \`${prefix}info\`
╰━━━━━━━━━━━━━━━╯

╭╼━≪ 👑 *OWNER ONLY* ≫━╾╮
┃ • \`${prefix}broadcast\` | \`${prefix}block\`
┃ • \`${prefix}setprefix\` | \`${prefix}setbotpp\`
┃ • \`${prefix}restart\` | \`${prefix}update\`
╰━━━━━━━━━━━━━━━╯

   *© 2026 ${botName} Framework*
   _Powered by Edun Oluwadarasimi_
        `.trim();
        
        await sock.sendMessage(msg.key.remoteJid, { 
            text: menuText,
            contextInfo: {
                externalAdReply: {
                    title: `${botName} System Active`,
                    body: "Advanced WhatsApp Automation",
                    thumbnailUrl: "https://github.com/edunoluwadarasimidavid.png",
                    sourceUrl: config.social?.github || "https://github.com/edunoluwadarasimidavid/EDBOTS",
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        });
    }
};
