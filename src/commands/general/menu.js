/**
 * Menu Command
 */

const commandHandler = require('../../core/commandHandler');
const config = require('../../../config');

module.exports = {
    name: "menu",
    aliases: ["help", "h"],
    description: "Display bot menu",
    cooldown: 5,
    category: "general",

    execute: async (sock, parsed, args) => {
        const { from, msg } = parsed;
        const commands = commandHandler.commands;
        const categories = {};

        // Group commands by category
        commands.forEach((cmd) => {
            const cat = cmd.category || 'other';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(cmd.name);
        });

        let menuText = `╭━━━≪ ${config.botName || 'EDBOT AI'} ≫━━━╮
`;
        menuText += `┃ Prefix: ${config.prefix}
`;
        menuText += `┃ Owner: ${config.ownerName[0]}
`;
        menuText += `┃ Total Commands: ${commands.size}
`;
        menuText += `╰━━━━━━━━━━━━━━━━━━━━╯

`;

        for (const [cat, cmds] of Object.entries(categories)) {
            menuText += `╭━━━≪ *${cat.toUpperCase()}* ≫━━━╮
`;
            cmds.forEach((cmd) => {
                menuText += `┃ ${config.prefix}${cmd}
`;
            });
            menuText += `╰━━━━━━━━━━━━━━━━━━━━╯

`;
        }

        menuText += `> _Type ${config.prefix}command_name for more info._`;

        await sock.sendMessage(from, { text: menuText }, { quoted: msg });
    }
};
