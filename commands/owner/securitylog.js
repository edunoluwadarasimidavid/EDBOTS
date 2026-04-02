const { getSecurityLogs } = require('../../database');

module.exports = {
  name: 'securitylog',
  aliases: ['seclog', 'logs'],
  category: 'owner',
  description: 'Show blocked attempts log',
  usage: '.securitylog',
  isOwner: true,
  execute: async (sock, msg, args, context) => {
    const { reply } = context;
    const logs = getSecurityLogs();
    if (logs.length === 0) return reply('📝 No security logs found.');

    let text = `📝 *SECURITY BLOCK LOGS*

`;
    logs.slice(-20).reverse().forEach((log, i) => {
      text += `${i + 1}. [${new Date(log.timestamp).toLocaleString()}]
`;
      text += `👤 Sender: ${log.sender.split('@')[0]}
`;
      text += `💬 Cmd: ${log.command}
`;
      text += `🚫 Reason: ${log.reason}

`;
    });

    await reply(text);
  }
};
