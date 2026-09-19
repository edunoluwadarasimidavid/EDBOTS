/**
 * QR Code Generator Command
 * Generate QR codes from text or URLs
 */

const axios = require('axios');
const APIs = require('../../utils/api');

module.exports = {
    name: 'qrgen',
    aliases: ['qr', 'qrmake'],
    category: 'utility',
    description: 'Generate a QR code from text or URL',
    usage: '.qrgen <text or URL>',
    
    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                return extra.reply(
                    `📱 *QR Code Generator*\n\n` +
                    `Usage: .qrgen <text or URL>\n\n` +
                    `*Examples:*\n` +
                    `• \`.qrgen https://google.com\`\n` +
                    `• \`.qrgen Hello World\`\n` +
                    `• \`.qrgen WiFi:T:WPA;S:MyNetwork;P:password;;\``
                );
            }

            const text = args.join(' ');
            await extra.reply('⏳ Generating QR code...');

            const qrUrl = APIs.getQRCodeUrl(text);
            const response = await axios.get(qrUrl, { responseType: 'arraybuffer' });

            await sock.sendMessage(extra.from, {
                image: Buffer.from(response.data),
                caption: `📱 *QR Code Generated!*\n\n📝 Content: ${text.length > 100 ? text.slice(0, 100) + '...' : text}`
            }, { quoted: msg });

        } catch (error) {
            console.error('[QRGEN ERROR]', error);
            await extra.reply('❌ Failed to generate QR code.');
        }
    }
};
