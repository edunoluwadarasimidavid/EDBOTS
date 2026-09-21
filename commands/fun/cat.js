/**
 * @file cat.js — Random cat images and cats with custom text.
 * Powered by thecatapi.com & cataas.com (free, no key).
 */

const { getCatImage, getCatSays } = require('../../utils/groupGames');

module.exports = {
    name: 'cat',
    aliases: ['cats', 'meow'],
    category: 'fun',
    description: 'Random cat photo, or a cat saying your text',
    usage: '.cat [your text]',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            const text = args.join(' ').trim();

            if (text) {
                // Cat with custom caption text baked into the image
                const url = await getCatSays(text);
                if (!url) return extra.reply('❌ Could not create cat meme. Try again.');

                await sock.sendMessage(extra.from, {
                    image: { url },
                    caption: `🐱 "${text}"\n\n> _Make your own: .cat <text>_`
                }, { quoted: msg });
            } else {
                const url = await getCatImage();
                if (!url) return extra.reply('❌ Could not fetch a cat right now.');

                await sock.sendMessage(extra.from, {
                    image: { url },
                    caption: `🐱 *Random Cat!*\n\n> _Tip: .cat <text> puts your text on a cat_`
                }, { quoted: msg });
            }
        } catch (err) {
            console.error('[CAT ERROR]', err.message);
            await extra.reply('❌ Cat delivery failed. The cats are napping.');
        }
    }
};
