// File: /commands/general/about.js
module.exports = {
  name: "about",
  aliases: ["me", "profile", "owner"],
  category: "general",
  description: "Display detailed information about the bot owner and projects",
  usage: ".about",
  
  async execute(sock, msg, args, extra) {
    try {
      const { loadCommands } = require('../../utils/commandLoader');
      const commands = loadCommands();

      // Count only main commands (ignore aliases)
      const mainCommands = new Set();
      commands.forEach((cmd, name) => {
        if (cmd.name === name) mainCommands.add(name);
      });

      // Build the impressive info message
      const response = `
🧑‍💻 *Owner Info - Edun Oluwadarasimi David*

📛 *Full Name:* Edun Oluwadarasimi David
📧 *Email:* davidedun2010@gmail.com
📱 *Phone:* +2349028375495
🏢 *Role:* Fullstack Developer & CEO, Smart Tech Programming
🌐 *Projects:* Bots, Web Apps, AI Tools, Automation Systems
🛠 *Skills:* Node.js, JavaScript, Python, AI, WhatsApp Bots, Web Development
🚀 *Vision:* Build scalable, leverage-based systems with AI & code to generate wealth
🎯 *Mission:* Teach, innovate, and automate real-world solutions using technology

📊 *Bot Stats:*
• Total Commands: ${mainCommands.size}
• Active Features: Dynamic command loader, AI tools integration, media handling
• Prefix: ${extra.prefix || "."}
• Current Uptime: ${process.uptime().toFixed(2)} seconds

💡 *Fun Facts:*
• Passionate about AI and automation
• Loves building tools that save time and create impact
• Always experimenting with new technologies

🌟 *Motivation Quote:*
_"Code is the brush, AI is the canvas, and we are the artists of the future."_

💌 *Tip:* Type ${extra.prefix || "."}menu to explore all commands and features!

`;

      await sock.sendMessage(extra.from, {
        text: response,
        mentions: [extra.sender]
      }, { quoted: msg });

    } catch (err) {
      await extra.reply(`❌ Error: ${err.message}`);
    }
  }
};