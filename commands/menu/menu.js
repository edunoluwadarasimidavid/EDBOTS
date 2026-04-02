const { getFormattedUptime } = require('../../utils/uptime');
const config = require('../../config');

module.exports = {
  name: 'menu',
  description: 'Displays the premium EDBOT AI system menu',
  category: 'menu',
  aliases: ['help', 'h', 'commands'],
  usage: '.menu',
  async handler(context) {
    const { sock, msg, commands, prefix, isOwner, isAdmin, isGroup } = context;
    
    // 1. DYNAMIC IDENTITY RESOLUTION
    const botNumber = sock?.user?.id ? sock.user.id.split(":")[0] : "Unknown";
    const pushName = msg.pushName || "User";
    const runtime = getFormattedUptime() || "0h 0m 0s";
    
    // DYNAMIC OWNER RESOLUTION (Step 4 & REQUIREMENT: OWNER NAME FIX)
    // We try to get the connected session owner's name
    const ownerPushName = sock?.user?.name || config.ownerName?.[0] || "EDBOTS Owner";
    const ownerNumber = sock?.user?.id ? sock.user.id.split("@")[0].split(":")[0] : config.owner?.[0];
    const ownerDisplayName = ownerPushName || ownerNumber;

    const mode = config.selfMode ? "Self (Private)" : "Public (Global)";
    
    let chatId = msg.key.remoteJid;
    if (msg.key.fromMe && sock?.user?.id) {
      chatId = sock.user.id.split(":")[0] + "@s.whatsapp.net";
    }

    try {
      // 2. BUILD A FILTER ENGINE (STRICT CONTEXT RULES)
      const uniqueCommands = commands instanceof Map ? new Set(commands.values()) : new Set();
      
      const visibleCommands = Array.from(uniqueCommands).filter(cmd => {
        // GLOBAL RBAC Rules
        if (cmd.ownerOnly && !isOwner) return false;
        if (cmd.adminOnly && !isAdmin && !isOwner) return false; // Owners can see admin cmds
        if (cmd.groupOnly && !isGroup) return false;

        // PRIVATE CHAT SPECIFIC EXCLUSIONS
        if (!isGroup) {
          const cat = (cmd.category || "").toLowerCase();
          const privateSafeCategories = ['ai', 'fun', 'general', 'media', 'textmaker', 'utility', 'menu', 'system'];
          const restrictedInPrivate = ['admin', 'group', 'moderation'];
          
          if (restrictedInPrivate.includes(cat)) return false;
          // Even if category is 'general', check if command specifically needs a group (redundant but safe)
          if (cmd.groupOnly) return false;
        }

        return true;
      });

      // 3. GROUPING & HIDING EMPTY CATEGORIES
      const grouped = {};
      visibleCommands.forEach((cmd) => {
        const category = (cmd.category || "GENERAL").toUpperCase().trim();
        if (!grouped[category]) grouped[category] = [];
        
        // Deduplicate command names
        if (!grouped[category].includes(cmd.name)) {
          grouped[category].push(cmd.name);
        }
      });

      // 4. HEADER CONSTRUCTION (EXACT REQUESTED FORMAT)
      const menuTitle = isGroup ? "GROUP SMART MENU" : "PUBLIC SMART MENU";
      
      let menuText = `╭━━━〔 ${menuTitle} 〕━━━⬣\n`;
      menuText += `┃ 👤 User: ${pushName.toUpperCase()}\n`;
      menuText += `┃ 👑 Owner: ${ownerDisplayName}\n`;
      menuText += `┃ 🔢 Bot: ${botNumber}\n`;
      menuText += `┃ 🏁 Prefix: ${prefix}\n`;
      menuText += `┃ ⏱️ Runtime: ${runtime}\n`;
      menuText += `┃ ⚙️ Mode: ${mode}\n`;
      menuText += `╰━━━━━━━━━━━━━━━━⬣\n\n`;

      // 5. DYNAMIC CATEGORY BLOCKS
      const sortedCategories = Object.keys(grouped).sort();

      for (const cat of sortedCategories) {
        // Double check for Private Chat: skip group/admin categories even if they somehow got here
        if (!isGroup && ['ADMIN', 'GROUP', 'MODERATION'].includes(cat)) continue;

        menuText += `╭━━━〔 ${cat} 〕━━━⬣\n`;
        const categoryCommands = grouped[cat].sort();
        
        categoryCommands.forEach(cmdName => {
          menuText += `┃ • ${prefix}${cmdName}\n`;
        });
        
        menuText += `╰━━━━━━━━━━━━━━━⬣\n\n`;
      }

      // 6. DELIVERY
      await sock.sendMessage(chatId, { 
        text: menuText.trim(),
        contextInfo: {
          externalAdReply: {
            title: `EDBOTS AI SYSTEM v3.0`,
            body: `Role-Based Automation Framework`,
            thumbnailUrl: "https://github.com/edunoluwadarasimidavid.png",
            sourceUrl: config.social?.github || "https://github.com/EDBOTS",
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg });

    } catch (err) {
      console.error("[REFAC MENU ERROR]", err);
      try {
        await context.reply("❌ Error rendering system menu. Contact admin.");
      } catch (e) {}
    }
  }
};
