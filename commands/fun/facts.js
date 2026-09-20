/**
 * @file facts.js
 * @description Fun facts, trivia, and interesting content from free APIs.
 * 
 * Commands:
 *   .fact       - Random fun fact
 *   .joke       - Random joke
 *   .quote      - Random quote
 *   .horoscope <sign> - Daily horoscope
 *   .advice     - Random life advice
 *   .catfact    - Random cat fact
 *   .dogfact    - Random dog fact
 *   .number <n> - Number trivia
 *   .bored      - Activity suggestion when bored
 *   .insult     - Random playful insult
 */

const {
    getFunFact,
    getJoke,
    getQuote,
    getHoroscope,
    getRandomActivity,
    getProgrammingJoke,
    getInsult,
    getCatFact,
    getDogFact,
    getNumberTrivia,
    getAdvice
} = require('../../utils/freeApis');

const HOROSCOPE_SIGNS = [
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
];

module.exports = {
    name: 'fact',
    aliases: ['funfact', 'randomfact'],
    category: 'fun',
    description: 'Get a random fun fact',
    usage: '.fact',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            const subCommand = args[0]?.toLowerCase();

            switch (subCommand) {
                case 'joke':
                case 'jokes': {
                    await extra.reply('😄 Getting a joke...');
                    const joke = await getJoke();
                    if (joke) return extra.reply(`😂 *Joke*\n\n${joke}`);
                    return extra.reply('❌ Could not fetch a joke. Try again!');
                }

                case 'quote':
                case 'quotes': {
                    await extra.reply('💬 Getting a quote...');
                    const quote = await getQuote();
                    if (quote) return extra.reply(`📜 *Inspirational Quote*\n\n${quote}`);
                    return extra.reply('❌ Could not fetch a quote. Try again!');
                }

                case 'horoscope':
                case 'horoscopes': {
                    const sign = args[1]?.toLowerCase();
                    if (!sign || !HOROSCOPE_SIGNS.includes(sign)) {
                        return extra.reply(
                            `🔮 *Horoscope*\n\n` +
                            `*Available signs:*\n${HOROSCOPE_SIGNS.join(', ')}\n\n` +
                            `*Usage:* \`.fact horoscope aries\``
                        );
                    }
                    await extra.reply(`🔮 Reading ${sign} horoscope...`);
                    const horoscope = await getHoroscope(sign);
                    if (horoscope) return extra.reply(horoscope);
                    return extra.reply('❌ Could not fetch horoscope. Try again!');
                }

                case 'advice': {
                    await extra.reply('💡 Getting advice...');
                    const advice = await getAdvice();
                    if (advice) return extra.reply(advice);
                    return extra.reply('❌ Could not fetch advice. Try again!');
                }

                case 'cat':
                case 'catfact':
                case 'cats': {
                    await extra.reply('🐱 Getting cat fact...');
                    const fact = await getCatFact();
                    if (fact) return extra.reply(fact);
                    return extra.reply('❌ Could not fetch cat fact. Try again!');
                }

                case 'dog':
                case 'dogfact':
                case 'dogs': {
                    await extra.reply('🐶 Getting dog fact...');
                    const fact = await getDogFact();
                    if (fact) return extra.reply(fact);
                    return extra.reply('❌ Could not fetch dog fact. Try again!');
                }

                case 'number':
                case 'num': {
                    const number = parseInt(args[1]);
                    if (isNaN(number)) {
                        return extra.reply(
                            `🔢 *Number Trivia*\n\n` +
                            `*Usage:* \`.fact number 42\`\n` +
                            `Or \`.fact number\` for a random number fact.`
                        );
                    }
                    await extra.reply(`🔢 Getting trivia for ${number}...`);
                    const trivia = await getNumberTrivia(number);
                    if (trivia) return extra.reply(trivia);
                    return extra.reply('❌ Could not fetch number trivia. Try again!');
                }

                case 'bored':
                case 'activity': {
                    await extra.reply('🎯 Finding an activity...');
                    const activity = await getRandomActivity();
                    if (activity) return extra.reply(activity);
                    return extra.reply('❌ Could not fetch activity. Try again!');
                }

                case 'insult':
                case 'roast': {
                    await extra.reply('😈 Generating insult...');
                    const insult = await getInsult();
                    if (insult) return extra.reply(insult);
                    return extra.reply('❌ Could not generate insult. Try again!');
                }

                case 'programming':
                case 'code':
                case 'dev': {
                    await extra.reply('💻 Getting programming joke...');
                    const joke = await getProgrammingJoke();
                    if (joke) return extra.reply(joke);
                    return extra.reply('❌ Could not fetch programming joke. Try again!');
                }

                default: {
                    // Get random fun fact
                    await extra.reply('🧠 Getting a fun fact...');
                    const fact = await getFunFact();
                    if (fact) return extra.reply(`🧠 *Fun Fact*\n\n${fact}`);
                    return extra.reply('❌ Could not fetch a fun fact. Try again!');
                }
            }
        } catch (error) {
            console.error('[FACT ERROR]', error);
            await extra.reply('❌ Error fetching fun content.');
        }
    }
};
