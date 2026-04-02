module.exports = {
  name: 'audit',
  aliases: ['checkcmds'],
  description: 'Run command audit to find issues with command files.',
  category: 'owner',
  usage: '.audit',
  isOwner: true,
  execute: async (sock, msg, args, context) => {
    const { commands, reply } = context;
    let report = `🔎 *COMMAND AUDIT REPORT*

`;
    let total = 0;
    let invalid = [];

    commands.forEach((cmd, name) => {
      total++;
      if (!cmd.handler && !cmd.execute) {
        invalid.push(`${name} (Missing Handler)`);
      }
      if (!cmd.category) {
        invalid.push(`${name} (Missing Category)`);
      }
    });

    report += `✅ Total Commands: ${total}
`;
    report += `⚠️ Issues Found: ${invalid.length}

`;

    if (invalid.length > 0) {
      report += `*Issues List:*
` + invalid.join('\n');
    } else {
      report += '✨ All commands passed validation.';
    }

    await reply(report);
  }
};
