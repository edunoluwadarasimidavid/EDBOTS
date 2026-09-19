/**
 * Invoice Command - Generate simple invoices for business
 */

module.exports = {
    name: 'invoice',
    aliases: ['bill', 'receipt'],
    category: 'business',
    description: 'Generate a simple invoice',
    usage: '.invoice <client> <items...> | <total>',
    groupOnly: false,

    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                return extra.reply(
                    `🧾 *Invoice Generator*\n\n` +
                    `Usage: .invoice <client> <item1:price> <item2:price> | <notes>\n\n` +
                    `*Example:*\n` +
                    `.invoice John Doe "Web Design:500" "Hosting:100" | Due in 30 days`
                );
            }

            // Parse arguments
            const fullText = args.join(' ');
            const parts = fullText.split('|');
            const clientPart = parts[0].trim();
            const notes = parts[1]?.trim() || 'Payment due upon receipt';

            // Extract items (format: "Item:Price" or just words)
            const itemRegex = /"([^"]+):(\d+(?:\.\d{2})?)"|(\S+):(\d+(?:\.\d{2})?)/g;
            const items = [];
            let match;
            let clientName = clientPart;

            while ((match = itemRegex.exec(clientPart)) !== null) {
                const name = match[1] || match[3];
                const price = parseFloat(match[2] || match[4]);
                items.push({ name, price });
                clientName = clientName.replace(match[0], '').trim();
            }

            // Clean up client name
            clientName = clientName.replace(/\s+/g, ' ').trim() || 'Customer';

            if (items.length === 0) {
                // Simple format: .invoice Client Total
                const total = parseFloat(args[args.length - 1]);
                if (!isNaN(total)) {
                    items.push({ name: 'Service', price: total });
                    clientName = args.slice(0, -1).join(' ') || 'Customer';
                } else {
                    return extra.reply('❌ Please include items with prices. Example:\n`.invoice John "Design:500" "Hosting:100"`');
                }
            }

            const total = items.reduce((sum, item) => sum + item.price, 0);
            const invoiceId = `INV-${Date.now().toString(36).toUpperCase().slice(-6)}`;
            const date = new Date().toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            let text = `╭━━━〔 🧾 *INVOICE* 〕━━━╮\n\n`;
            text += `📋 *Invoice ID:* ${invoiceId}\n`;
            text += `📅 *Date:* ${date}\n`;
            text += `👤 *Client:* ${clientName}\n`;
            text += `📍 *From:* ${extra.sender.split('@')[0]}\n\n`;
            text += `╭━━━━━━━━━━━━━━━━━━━━╮\n`;

            items.forEach((item, i) => {
                text += `┃ ${i + 1}. ${item.name}\n`;
                text += `┃    $${item.price.toFixed(2)}\n`;
            });

            text += `╰━━━━━━━━━━━━━━━━━━━━╯\n`;
            text += `💰 *TOTAL: $${total.toFixed(2)}*\n\n`;
            text += `📝 *Notes:* ${notes}\n\n`;
            text += `> _This is a simulated invoice for record keeping_`;

            await extra.reply(text);

        } catch (error) {
            console.error('[INVOICE ERROR]', error);
            await extra.reply('❌ Error generating invoice.');
        }
    }
};
