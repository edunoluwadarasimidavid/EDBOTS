/**
 * @file namegame.js — Name predictions: age, gender, nationality.
 * Powered by agify.io, genderize.io, nationalize.io (free, no key).
 * Great party trick for groups: everyone checks their name!
 */

const { predictAge, predictGender, predictNationality } = require('../../utils/groupGames');

module.exports = {
    name: 'namegame',
    aliases: ['myname', 'nameinfo'],
    category: 'fun',
    description: 'AI predicts age, gender & nationality from a name',
    usage: '.namegame <name>',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            const name = (args[0] || '').trim();
            if (!name) {
                return extra.reply('🔮 Usage: `.namegame David`\n\nPredicts age, gender & nationality from a name!');
            }

            await extra.reply('🔮 Analyzing name…');

            const [age, gender, nationality] = await Promise.all([
                predictAge(name),
                predictGender(name),
                predictNationality(name)
            ]);

            let text = `🔮 *Name Analysis: ${name}*\n\n`;

            text += `🎂 *Predicted Age:* ${age ? `${age.age} years` : 'unknown'}\n`;
            text += `   (${age?.count || 0} records analyzed)\n\n`;

            text += `⚧ *Predicted Gender:* ${gender ? `${gender.gender} (${Math.round(gender.probability * 100)}% confident)` : 'unknown'}\n\n`;

            text += `🌍 *Likely Nationality:*\n`;
            if (nationality && nationality.countries.length > 0) {
                nationality.countries.forEach(c => { text += `   • ${c}\n`; });
            } else {
                text += `   • unknown\n`;
            }

            text += `\n> _Just for fun — not science! 😄_`;

            await extra.reply(text);
        } catch (err) {
            console.error('[NAMEGAME ERROR]', err.message);
            await extra.reply('❌ Name analysis failed.');
        }
    }
};
