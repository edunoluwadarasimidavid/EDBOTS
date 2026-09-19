/**
 * Crypto Price Command
 * Get real-time cryptocurrency prices
 */

const axios = require('axios');

const COIN_IDS = {
    'btc': 'bitcoin', 'eth': 'ethereum', 'sol': 'solana',
    'doge': 'dogecoin', 'ada': 'cardano', 'xrp': 'ripple',
    'bnb': 'binancecoin', 'dot': 'polkadot', 'matic': 'matic-network',
    'shib': 'shiba-inu', 'avax': 'avalanche-2', 'link': 'chainlink',
    'ltc': 'litecoin', 'uni': 'uniswap', 'atom': 'cosmos',
    'trx': 'tron', 'algo': 'algorand', 'near': 'near',
    'apt': 'aptos', 'arb': 'arbitrum', 'op': 'optimism',
    'sui': 'sui', 'pepe': 'pepe', 'bnb': 'binancecoin'
};

const COIN_EMOJIS = {
    'btc': '₿', 'eth': '⟠', 'sol': '◎', 'doge': '🐕',
    'ada': '₳', 'xrp': '✕', 'bnb': '◆', 'matic': '⬡'
};

module.exports = {
    name: 'crypto',
    aliases: ['coin', 'price', 'coingecko'],
    category: 'utility',
    description: 'Get real-time cryptocurrency prices',
    usage: '.crypto <coin> (e.g., .crypto btc, .crypto eth)',
    
    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                const supported = Object.keys(COIN_IDS).slice(0, 12).join(', ');
                return extra.reply(
                    `📊 *Crypto Price Tracker*\n\n` +
                    `Usage: .crypto <coin>\n\n` +
                    `*Supported coins:*\n${supported}\n\n` +
                    `*Examples:*\n` +
                    `• \`.crypto btc\` - Bitcoin price\n` +
                    `• \`.crypto eth\` - Ethereum price\n` +
                    `• \`.crypto doge\` - Dogecoin price`
                );
            }

            const input = args[0].toLowerCase();
            const coinId = COIN_IDS[input];

            if (!coinId) {
                return extra.reply(`❌ Unknown coin "${input}". Use \`.crypto\` to see supported coins.`);
            }

            await extra.reply('⏳ Fetching price...');

            const response = await axios.get(
                `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
                { timeout: 10000 }
            );

            const data = response.data[coinId];
            if (!data) {
                return extra.reply(`❌ Could not fetch data for "${input}".`);
            }

            const price = data.usd;
            const change = data.usd_24h_change || 0;
            const marketCap = data.usd_market_cap || 0;
            const volume = data.usd_24h_vol || 0;

            const formatNum = (n) => {
                if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
                if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
                if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
                return `$${n.toLocaleString()}`;
            };

            const changeEmoji = change >= 0 ? '📈' : '📉';
            const changeSign = change >= 0 ? '+' : '';

            const text = `${COIN_EMOJIS[input] || '🪙'} *${coinId.charAt(0).toUpperCase() + coinId.slice(1)} (${input.toUpperCase()})*\n\n` +
                `💰 *Price:* $${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
                `${changeEmoji} *24h Change:* ${changeSign}${change.toFixed(2)}%\n` +
                `📊 *Market Cap:* ${formatNum(marketCap)}\n` +
                `📦 *24h Volume:* ${formatNum(volume)}\n\n` +
                `_Data from CoinGecko_`;

            await extra.reply(text);

        } catch (error) {
            console.error('[CRYPTO ERROR]', error);
            await extra.reply('❌ Error fetching crypto data. Try again later.');
        }
    }
};
