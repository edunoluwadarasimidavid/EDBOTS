/**
 * Joke Command - Multi-category safe-mode jokes
 * Powered by JokeAPI (v2.jokeapi.dev) with official-joke-api fallback.
 */

const { getSafeJoke } = require('../../utils/groupGames');

module.exports = {
    name: 'joke',
    aliases: ['jokes'],
    category: 'fun',
    description: 'Random joke — programming, misc, pun, spooky or any',
    usage: '.joke [programming|misc|pun|spooky]',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            const valid = ['programming', 'misc', 'pun', 'spooky'];
            let category = 'Any';
            if (args[0] && valid.includes(args[0].toLowerCase())) {
                category = args[0].charAt(0).toUpperCase() + args[0].slice(1);
            }

            const joke = await getSafeJoke(category === 'Any' ? 'Any' : category);
            if (!joke) return extra.reply('❌ No jokes available right now. Try again!');
            await extra.reply(joke);
        } catch (error) {
            await extra.reply(`❌ Error: ${error.message}`);
        }
    }
};
