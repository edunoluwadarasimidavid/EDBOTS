const { readJson } = require('../../utils/safeJson');
const { formatUptime } = require('../../utils/uptime');
const path = require('path');

const BOT_CONFIG = path.join(__dirname, '../../config/bot.json');

module.exports = {
    name: 'menu',
    description: 'Displays the bot dashboard and command list',
    category: 'menu',
    async execute(sock, msg, args, extra) {
        try {
            const bot = await readJson(BOT_CONFIG, {
                version: "1.0.6",
                prefix: ".",
                owner: "Edun Oluwadarasimi David"
            });

            const uptime = formatUptime();
            const { owner, prefix, version } = bot;

            const menuText = `╭─╼─≪ *EDBOTS* ≫─╼─╮
│ 🤖 *User:* ${owner}
│ ⏱️ *Uptime:* ${uptime}
│ 👑 *Prefix:* [ ${prefix} ]
│ ⚙️ *Version:* v${version}
╰╼━━━━━━━━━━━━━━━╾╯

╭╼━≪ 🧠 *AI & AUTOMATION* ≫━╾╮
┃ • .edbot-ai
┃ • ai:
┃ • .auto-reply
┃ • .magicstudio
╰━━━━━━━━━━━━━━━╯

╭╼━≪ 🛡️ *ADMINISTRATION* ≫━╾╮
┃ • .kick
┃ • .promote
┃ • .mute
┃ • .unmute
┃ • .hidetag
┃ • .tagall
┃ • .antilink
┃ • .antitag
┃ • .welcome
┃ • .goodbye
╰━━━━━━━━━━━━━━━╯

╭╼━≪ 🎮 *ENTERTAINMENT* ≫━╾╮
┃ • .joke
┃ • .meme
┃ • • .ship
┃ • .truth
┃ • .dare
┃ • .gayrate
┃ • .waifu
┃ • .neko
╰━━━━━━━━━━━━━━━╯

╭╼━≪ 📥 *DOWNLOADER* ≫━╾╮
┃ • .song
┃ • .video
┃ • .lyrics
┃ • .tiktok
┃ • .ig
┃ • .fb
┃ • .ytsearch
┃ • .play
╰━━━━━━━━━━━━━━━╯

╭╼━≪ 🎨 *TEXT & MEDIA* ≫━╾╮
┃ • .sticker
┃ • .attp
┃ • .tts
┃ • .carbon
┃ • .neon
┃ • .fire
┃ • .glitch
╰━━━━━━━━━━━━━━━╯

╭╼━≪ 🛠️ *UTILITIES* ≫━╾╮
┃ • .weather
┃ • .translate
┃ • .calc
┃ • .ssweb
┃ • .qr
┃ • .ping
┃ • .uptime
┃ • .info
╰━━━━━━━━━━━━━━━╯

╭╼━≪ 👑 *OWNER ONLY* ≫━╾╮
┃ • .broadcast
┃ • .block
┃ • .setprefix
┃ • .setbotpp
┃ • .restart
┃ • .update
╰━━━━━━━━━━━━━━━╯

> *Type .help <command> for details*

*© 2026 EDBOTS Framework*
_Powered by Edun Oluwadarasimi_`.trim();

            await sock.sendMessage(msg.key.remoteJid, { text: menuText }, { quoted: msg });
        } catch (error) {
            console.error('Menu command error:', error);
        }
    }
};
