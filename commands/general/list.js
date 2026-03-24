/**
 * List Command
 * Show all commands as a simple text list
 */

module.exports = {
  name: 'list',
  aliases: ['commands', 'allcmds'],
  category: 'general',
  description: 'List all commands',
  usage: '.list',
  
  async execute(sock, msg, args, context) {
    try {
      const { commands, reply, prefix } = context;
      const categories = {};
      let totalCommands = 0;

      commands.forEach((cmd, key) => {
        // Only count the main entry, skip aliases
        if (cmd.name.toLowerCase() === key) {
            const cat = (cmd.category || 'general').toUpperCase();
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(cmd.name);
            totalCommands++;
        }
      });

      let text = `📜 *ALL COMMANDS*\n\n`;
      const sortedCats = Object.keys(categories).sort();

      for (const cat of sortedCats) {
        text += `*${cat}*\n`;
        text += `\`\`\`${categories[cat].sort().join(', ')}\`\`\`\n\n`;
      }

      text += `_Total Unique Commands: ${totalCommands}_\n`;
      text += `_Type ${prefix}help <command> for details_`;

      await reply(text);

    } catch (error) {
      console.error('List error:', error);
      await context.reply('❌ Failed to list commands.');
    }
  }
};
