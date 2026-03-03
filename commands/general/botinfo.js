const { loadCommands } = require('../../utils/commandLoader');

// Helper to format uptime from seconds to a readable string
function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor(seconds % (3600 * 24) / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 60);

  let uptime = '';
  if (d > 0) uptime += `${d} day${d > 1 ? 's' : ''}, `;
  if (h > 0) uptime += `${h} hour${h > 1 ? 's' : ''}, `;
  if (m > 0) uptime += `${m} minute${m > 1 ? 's' : ''}, `;
  uptime += `${s} second${s > 1 ? 's' : ''}`;
  
  return uptime;
}

// Helper to format memory usage to MB
function formatMemory(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

module.exports = {
  name: 'botinfo',
  category: 'general',
  description: 'Display information about the bot',
  usage: '.botinfo',
  
  async execute(sock, msg, args, extra) {
    try {
      // Gather information
      const nodeVersion = process.version;
      const platform = process.platform;
      const memoryUsage = formatMemory(process.memoryUsage().rss);
      const totalCommands = loadCommands().size;
      const uptime = formatUptime(process.uptime());
      
      // Construct the message
      const infoText = `*🤖 Bot Information*\n\n` +
                       `- *Node.js Version:* ${nodeVersion}\n` +
                       `- *Platform:* ${platform}\n` +
                       `- *Memory Usage:* ${memoryUsage}\n` +
                       `- *Total Commands:* ${totalCommands}\n` +
                       `- *Uptime:* ${uptime}`;
                       
      await extra.reply(infoText);
      
    } catch (error) {
      console.error('Error in botinfo command:', error);
      await extra.reply('❌ An error occurred while fetching bot information.');
    }
  }
};
