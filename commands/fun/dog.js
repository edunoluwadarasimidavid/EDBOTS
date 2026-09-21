/**
 * @file dog.js — Random dog photos by breed.
 * Powered by dog.ceo (free, no key).
 */

const { getDogImage } = require('../../utils/groupGames');

module.exports = {
    name: 'dog',
    aliases: ['dogs', 'doggo', 'puppy'],
    category: 'fun',
    description: 'Random dog photo (optionally by breed)',
    usage: '.dog [breed]',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            const breed = args[0] || null;
            const url = await getDogImage(breed);

            if (!url) {
                return extra.reply(
                    `❌ No image found${breed ? ` for breed *${breed}*` : ''}.\n` +
                    `Try: labrador, shiba, pug, retriever, husky, beagle…`
                );
            }

            await sock.sendMessage(extra.from, {
                image: { url },
                caption: `🐶 *Woof!*${breed ? ` (${breed})` : ''}\n\n> _Powered by dog.ceo_`
            }, { quoted: msg });
        } catch (err) {
            console.error('[DOG ERROR]', err.message);
            await extra.reply('❌ Could not fetch a dog photo.');
        }
    }
};
