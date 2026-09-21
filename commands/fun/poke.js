/**
 * @file poke.js — Pokémon lookup with sprite, stats, and flavor.
 * Powered by pokeapi.co (free, no key).
 */

const { getPokemon } = require('../../utils/groupGames');

module.exports = {
    name: 'poke',
    aliases: ['pokemon'],
    category: 'fun',
    description: 'Look up a Pokémon with stats and image',
    usage: '.poke <name>',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            const name = (args[0] || '').trim();
            if (!name) {
                return extra.reply('🔴 Usage: `.poke pikachu`');
            }

            const p = await getPokemon(name);
            if (!p) {
                return extra.reply(`❌ Pokémon *${name}* not found. Check spelling!`);
            }

            await sock.sendMessage(extra.from, {
                image: { url: p.sprite },
                caption:
                    `🔴 *${p.name.toUpperCase()}* (#${p.id})\n\n` +
                    `🏷️ Type: ${p.types}\n` +
                    `📏 Height: ${p.height}\n` +
                    `⚖️ Weight: ${p.weight}\n` +
                    `✨ Abilities: ${p.abilities}\n\n` +
                    `> _Data from PokéAPI_`
            }, { quoted: msg });
        } catch (err) {
            console.error('[POKE ERROR]', err.message);
            await extra.reply('❌ Could not fetch Pokémon data.');
        }
    }
};
