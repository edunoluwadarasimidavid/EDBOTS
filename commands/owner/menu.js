const { readJson, getFormattedUptime, BOT_CONFIG_PATH, OWNER_MENU_PATH } = require('../../utils/botManager');

module.exports = {
    name: 'menu',
    description: 'Displays the bot command menu',
    category: 'owner',
    async execute(sock, msg, args, extra) {
        try {
            // Load configuration
            const botConfig = await readJson(BOT_CONFIG_PATH, {
                version: "1.0.6",
                prefix: ".",
                owner: "Edun Oluwadarasimi David"
            });

            // Load custom menu override if exists
            const customMenu = await readJson(OWNER_MENU_PATH, { menu: "" });

            if (customMenu.menu && customMenu.menu.trim() !== "") {
                return await extra.reply(customMenu.menu);
            }

            const uptime = getFormattedUptime();
            const { owner, prefix, version } = botConfig;

            // Generate Default Menu
            const menu = `╭─╼─≪ *EDBOTS* ≫─╼─╮
│ 🤖 *User:* ${owner}
│ ⏱️ *Uptime:* ${uptime}
│ 👑 *Prefix:* [ ${prefix} ]
│ ⚙️ *Version:* v${version}
╰╼━━━━━━━━━━━━━━━╾╯

*AI & AUTOMATION*
┃ .ai <question>
┃ .edbot-ai <question>
┃ .auto-reply <on/off>

*ADMINISTRATION*
┃ .kick @user
┃ .promote @user
┃ .demote @user
┃ .groupinfo

*ENTERTAINMENT*
┃ .joke
┃ .meme
┃ .truth
┃ .dare

*DOWNLOADER*
┃ .song <name>
┃ .video <link>
┃ .tiktok <link>

*TEXT & MEDIA*
┃ .sticker
┃ .attp <text>
┃ .tts <text>

*UTILITIES*
┃ .weather <city>
┃ .translate <text>
┃ .calc <expr>

*OWNER ONLY*
┃ .update
┃ .restart
┃ .broadcast <text>

╭╼━━━━━━━━━━━━━━━╾╮
┃ *© 2026 EDBOTS*
╰━━━━━━━━━━━━━━━╯`.trim();

            await extra.reply(menu);
        } catch (error) {
            console.error('Menu command error:', error);
            await extra.reply('❌ An error occurred while generating the menu.');
        }
    }
};
