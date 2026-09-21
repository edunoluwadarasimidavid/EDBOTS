/**
 * @file chuck.js — Chuck Norris jokes.
 * Powered by api.chucknorris.io (free, no key).
 */

const { getChuckNorrisJoke } = require('../../utils/groupGames');

module.exports = {
    name: 'chuck',
    aliases: ['chucknorris', 'norris'],
    category: 'fun',
    description: 'Chuck Norris jokes',
    usage: '.chuck',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            const joke = await getChuckNorrisJoke();
            if (!joke) return extra.reply('❌ Could not fetch a Chuck Norris joke.');
            await extra.reply(joke);
        } catch (err) {
            console.error('[CHUCK ERROR]', err.message);
            await extra.reply('❌ Chuck is too busy roundhouse-kicking servers.');
        }
    }
};
