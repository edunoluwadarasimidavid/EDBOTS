/**
 * @file cx.js — Currency converter for business & group use.
 * Powered by exchangerate.host (free, no key).
 */

const { convertCurrency } = require('../../utils/groupGames');

module.exports = {
    name: 'cx',
    aliases: ['currency', 'exchange', 'rate'],
    category: 'business',
    description: 'Convert between currencies at live rates',
    usage: '.cx <amount> <FROM> <TO>  ·  e.g. .cx 100 USD NGN',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            if (args.length < 2) {
                return extra.reply(
                    `💱 *Currency Converter*\n\n` +
                    `Usage: \`.cx <amount> <FROM> <TO>\`\n\n` +
                    `Examples:\n` +
                    `• \`.cx 100 USD NGN\`\n` +
                    `• \`.cx 50 EUR GBP\`\n` +
                    `• \`.cx 1 USD NGN\` (rate check)`
                );
            }

            const amount = parseFloat(args[0]);
            const from = args[1];
            const to = args[2] || 'USD';

            if (isNaN(amount) || amount <= 0) {
                return extra.reply('❌ Invalid amount. Example: `.cx 100 USD NGN`');
            }

            const result = await convertCurrency(from, to, amount);
            if (!result) return extra.reply('❌ Could not fetch exchange rate. Try again.');

            const fmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

            await extra.reply(
                `💱 *Exchange Rate*\n\n` +
                `${fmt(result.amount)} ${result.from} = *${fmt(result.result)} ${result.to}*\n\n` +
                `📈 Rate: 1 ${result.from} = ${result.rate ? result.rate.toFixed(4) : '?'} ${result.to}\n\n` +
                `> _Live rates via exchangerate-api.com_`
            );
        } catch (err) {
            console.error('[CX ERROR]', err.message);
            await extra.reply('❌ Conversion failed. Check currency codes (USD, EUR, NGN…).');
        }
    }
};
