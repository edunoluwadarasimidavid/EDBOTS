/**
 * Contact Card Command - Generate and share contact cards (vCard)
 */

const axios = require('axios');
const APIs = require('../../utils/api');

module.exports = {
    name: 'contact',
    aliases: ['vcard', 'mycard', 'sharecontact'],
    category: 'general',
    description: 'Generate a shareable contact card with QR code',
    usage: '.contact <name> <phone> [email] [organization]',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            if (args.length < 2) {
                return extra.reply(
                    `📇 *Contact Card Generator*\n\n` +
                    `*Usage:* \`.contact <name> <phone> [email] [org]\`\n\n` +
                    `*Examples:*\n` +
                    `• \`.contact John Doe +1234567890\`\n` +
                    `• \`.contact Jane +1234567890 jane@email.com Tech Corp\`\n\n` +
                    `*Or use shortcuts:*\n` +
                    `• \`.contact me\` - Share your own contact\n` +
                    `• \`.mycard\` - Generate your personal card`
                );
            }

            // Handle "me" shortcut - use sender's info
            if (args[0] === 'me') {
                const profile = memory?.getUserProfile?.(extra.sender);
                const name = msg.pushName || 'Contact';
                const phone = extra.sender.split('@')[0];

                const qrUrl = APIs.getQRCodeUrl(`BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL:${phone}\nEND:VCARD`);

                await sock.sendMessage(extra.from, {
                    image: { url: qrUrl },
                    caption: `📇 *Contact Card*\n\n👤 Name: ${name}\n📱 Phone: +${phone}\n\n💡 Scan QR to save contact`
                }, { quoted: msg });
                return;
            }

            const name = args[0] + (args[1] && !args[1].startsWith('+') ? ' ' + args[1] : '');
            const phone = args.find(a => a.startsWith('+') || /^\d{10,}$/.test(a));
            const email = args.find(a => a.includes('@'));
            const org = args.filter(a => a !== name && a !== phone && a !== email && !a.startsWith('+')).join(' ');

            if (!phone) {
                return extra.reply('❌ Please provide a phone number (e.g., +1234567890)');
            }

            // Generate vCard
            let vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL:${phone}\n`;
            if (email) vcard += `EMAIL:${email}\n`;
            if (org) vcard += `ORG:${org}\n`;
            vcard += `END:VCARD`;

            // Generate QR code
            const qrUrl = APIs.getQRCodeUrl(vcard);

            let text = `📇 *Contact Card*\n\n`;
            text += `👤 Name: *${name}*\n`;
            text += `📱 Phone: *${phone}*\n`;
            if (email) text += `📧 Email: ${email}\n`;
            if (org) text += `🏢 Organization: ${org}\n`;
            text += `\n💡 *Scan the QR code to save this contact*`;

            await sock.sendMessage(extra.from, {
                image: { url: qrUrl },
                caption: text
            }, { quoted: msg });

        } catch (error) {
            console.error('[CONTACT ERROR]', error);
            await extra.reply('❌ Error generating contact card.');
        }
    }
};
