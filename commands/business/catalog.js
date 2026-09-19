/**
 * Catalog Command - Product/service catalog for businesses
 * Add, list, search, and manage products
 */

const fs = require('fs');
const path = require('path');

const CATALOG_FILE = path.join(__dirname, '../../data/catalog.json');

function loadCatalog() {
    try {
        if (!fs.existsSync(CATALOG_FILE)) {
            fs.writeFileSync(CATALOG_FILE, JSON.stringify({}));
            return {};
        }
        return JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveCatalog(data) {
    try {
        const dir = path.dirname(CATALOG_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CATALOG_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[Catalog] Save error:', e);
    }
}

module.exports = {
    name: 'catalog',
    aliases: ['product', 'products', 'shop'],
    category: 'business',
    description: 'Manage product/service catalog',
    usage: '.catalog <action> [args]',
    groupOnly: false,

    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                return extra.reply(
                    `🛒 *Product Catalog*\n\n` +
                    `*Actions:*\n` +
                    `• \`.catalog add <name> <price> <description>\` - Add product\n` +
                    `• \`.catalog list\` - View all products\n` +
                    `• \`.catalog search <keyword>\` - Search products\n` +
                    `• \`.catalog remove <name>\` - Remove product\n` +
                    `• \`.catalog info <name>\` - Product details\n` +
                    `• \`.catalog banner\` - Generate catalog banner\n\n` +
                    `*Example:*\n\`.catalog add Wireless Mouse $25 Ergonomic wireless mouse with USB receiver\``
                );
            }

            const action = args[0].toLowerCase();
            const chatId = extra.from;
            const catalog = loadCatalog();

            if (!catalog[chatId]) catalog[chatId] = {};

            switch (action) {
                case 'add': {
                    if (args.length < 3) {
                        return extra.reply('❌ Usage: `.catalog add <name> <price> <description>`');
                    }
                    const name = args[1];
                    const price = args[2];
                    const description = args.slice(3).join(' ') || 'No description';

                    catalog[chatId][name.toLowerCase()] = {
                        name,
                        price,
                        description,
                        addedBy: extra.sender,
                        createdAt: Date.now()
                    };
                    saveCatalog(catalog);

                    return extra.reply(
                        `✅ *Product Added!*\n\n` +
                        `📦 Name: *${name}*\n` +
                        `💰 Price: *${price}*\n` +
                        `📝 Description: ${description}`
                    );
                }

                case 'list':
                case 'ls': {
                    const products = Object.values(catalog[chatId]);
                    if (products.length === 0) {
                        return extra.reply('🛒 Your catalog is empty. Add products with `.catalog add`');
                    }

                    let text = `🛒 *Product Catalog (${products.length} items):*\n\n`;
                    products.forEach((p, i) => {
                        text += `${i + 1}. *${p.name}* - ${p.price}\n   ${p.description.slice(0, 60)}${p.description.length > 60 ? '...' : ''}\n`;
                    });
                    text += `\nReply with \`.catalog info <name>\` for details`;
                    return extra.reply(text);
                }

                case 'search': {
                    const query = args.slice(1).join(' ').toLowerCase();
                    if (!query) return extra.reply('❌ Usage: `.catalog search <keyword>`');

                    const results = Object.values(catalog[chatId]).filter(p =>
                        p.name.toLowerCase().includes(query) ||
                        p.description.toLowerCase().includes(query)
                    );

                    if (results.length === 0) {
                        return extra.reply(`❌ No products found matching "${query}"`);
                    }

                    let text = `🔍 *Search Results (${results.length}):*\n\n`;
                    results.forEach((p, i) => {
                        text += `${i + 1}. *${p.name}* - ${p.price}\n   ${p.description.slice(0, 60)}\n`;
                    });
                    return extra.reply(text);
                }

                case 'remove':
                case 'rm':
                case 'del': {
                    const name = args[1]?.toLowerCase();
                    if (!name) return extra.reply('❌ Usage: `.catalog remove <product name>`');
                    if (catalog[chatId][name]) {
                        const removed = catalog[chatId][name];
                        delete catalog[chatId][name];
                        saveCatalog(catalog);
                        return extra.reply(`✅ Removed: *${removed.name}*`);
                    }
                    return extra.reply(`❌ Product "${args[1]}" not found.`);
                }

                case 'info': {
                    const name = args[1]?.toLowerCase();
                    if (!name) return extra.reply('❌ Usage: `.catalog info <product name>`');
                    const product = catalog[chatId][name];
                    if (!product) return extra.reply(`❌ Product "${args[1]}" not found.`);

                    return extra.reply(
                        `📦 *${product.name}*\n\n` +
                        `💰 Price: *${product.price}*\n` +
                        `📝 Description: ${product.description}\n` +
                        `📅 Added: ${new Date(product.createdAt).toLocaleDateString()}\n` +
                        `👤 By: @${product.addedBy.split('@')[0]}`
                    );
                }

                case 'banner': {
                    const products = Object.values(catalog[chatId]);
                    if (products.length === 0) return extra.reply('🛒 Add products first!');

                    let banner = `╭━━━〔 🛒 *CATALOG* 〕━━━╮\n`;
                    banner += `┃ 📦 ${products.length} Products Available\n`;
                    banner += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;

                    products.slice(0, 8).forEach((p, i) => {
                        banner += `╭━━━〔 ${i + 1} 〕━━━╮\n`;
                        banner += `┃ *${p.name}*\n`;
                        banner += `┃ 💰 ${p.price}\n`;
                        banner += `┃ 📝 ${p.description.slice(0, 40)}\n`;
                        banner += `╰━━━━━━━━━━━━━━━━━━╯\n\n`;
                    });

                    if (products.length > 8) {
                        banner += `_...and ${products.length - 8} more products_\n`;
                    }
                    banner += `\n> Reply with product name for details`;

                    return extra.reply(banner);
                }

                default:
                    return extra.reply('❌ Unknown action. Use `add`, `list`, `search`, `remove`, `info`, or `banner`.');
            }

        } catch (error) {
            console.error('[CATALOG ERROR]', error);
            await extra.reply('❌ Error managing catalog.');
        }
    }
};
