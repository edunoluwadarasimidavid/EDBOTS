const { readJson } = require('../../utils/safeJson');
const path = require('path');

const HELP_FILE = path.join(__dirname, '../../data/commandHelp.json');

module.exports = {
    name: 'help',
    description: 'Detailed command documentation',
    category: 'system',
    async execute(sock, msg, args, extra) {
        try {
            if (!args[0]) {
                return await sock.sendMessage(msg.key.remoteJid, { text: "❓ Usage: *.help <command_name>*
Example: *.help kick*" }, { quoted: msg });
            }

            const commandName = args[0].toLowerCase().replace('.', '');
            const helpData = await readJson(HELP_FILE, {});

            const cmd = helpData[commandName];

            if (!cmd) {
                return await sock.sendMessage(msg.key.remoteJid, { text: `❌ Help for command *${commandName}* not found.` }, { quoted: msg });
            }

            const helpText = `╭─≪ *COMMAND HELP* ≫─╮
│ *Command:* .${commandName}
│
│ *Description:*
│ ${cmd.description}
│
│ *Usage:*
│ ${cmd.usage}
│
│ *Permissions:*
│ ${cmd.permission || 'Everyone'}
│
│ *Example:*
│ ${cmd.example}
╰━━━━━━━━━━━━━━━╯`.trim();

            await sock.sendMessage(msg.key.remoteJid, { text: helpText }, { quoted: msg });
        } catch (error) {
            console.error('Help command error:', error);
        }
    }
};
