/**
 * Converter Command
 * Convert between Binary, Hex, Base64, and text
 */

module.exports = {
    name: 'convert',
    aliases: ['converter', 'base64', 'binary', 'hex'],
    category: 'utility',
    description: 'Convert between Binary, Hex, Base64, and Text',
    usage: '.convert <type> <text> or reply to a message',
    
    async execute(sock, msg, args, extra) {
        try {
            if (args.length < 2) {
                return extra.reply(
                    `🔄 *Unit Converter*\n\n` +
                    `Usage: .convert <type> <text>\n\n` +
                    `*Types:*\n` +
                    `• \`b2t\` - Binary to Text\n` +
                    `• \`t2b\` - Text to Binary\n` +
                    `• \`h2t\` - Hex to Text\n` +
                    `• \`t2h\` - Text to Hex\n` +
                    `• \`b64d\` - Base64 Decode\n` +
                    `• \`b64e\` - Base64 Encode\n` +
                    `• \`rot13\` - ROT13 Cipher\n\n` +
                    `*Examples:*\n` +
                    `• \`.convert t2b Hello\`\n` +
                    `• \`.convert b64e SecretText\`\n` +
                    `• \`.convert rot13 Hello\``
                );
            }

            const type = args[0].toLowerCase();
            const input = args.slice(1).join(' ');
            let result = '';

            switch (type) {
                case 't2b': // Text to Binary
                    result = input.split('').map(c => 
                        c.charCodeAt(0).toString(2).padStart(8, '0')
                    ).join(' ');
                    break;

                case 'b2t': // Binary to Text
                    try {
                        result = input.split(' ').map(bin =>
                            String.fromCharCode(parseInt(bin, 2))
                        ).join('');
                    } catch (e) {
                        return extra.reply('❌ Invalid binary format. Use space-separated 8-bit chunks (e.g., 01001000 01100101)');
                    }
                    break;

                case 't2h': // Text to Hex
                    result = input.split('').map(c => 
                        c.charCodeAt(0).toString(16).padStart(2, '0')
                    ).join(' ');
                    break;

                case 'h2t': // Hex to Text
                    try {
                        result = input.replace(/\s/g, '').match(/.{1,2}/g).map(hex =>
                            String.fromCharCode(parseInt(hex, 16))
                        ).join('');
                    } catch (e) {
                        return extra.reply('❌ Invalid hex format. Use space-separated hex pairs (e.g., 48 65 6c 6c 6f)');
                    }
                    break;

                case 'b64e': // Base64 Encode
                    result = Buffer.from(input).toString('base64');
                    break;

                case 'b64d': // Base64 Decode
                    try {
                        result = Buffer.from(input, 'base64').toString('utf8');
                    } catch (e) {
                        return extra.reply('❌ Invalid Base64 string.');
                    }
                    break;

                case 'rot13': // ROT13
                    result = input.replace(/[a-zA-Z]/g, c => {
                        const base = c <= 'Z' ? 65 : 97;
                        return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
                    });
                    break;

                default:
                    return extra.reply(`❌ Unknown type "${type}". Use \`b2t\`, \`t2b\`, \`h2t\`, \`t2h\`, \`b64d\`, \`b64e\`, or \`rot13\`.`);
            }

            const typeNames = {
                'b2t': 'Binary → Text', 't2b': 'Text → Binary',
                'h2t': 'Hex → Text', 't2h': 'Text → Hex',
                'b64d': 'Base64 → Text', 'b64e': 'Text → Base64',
                'rot13': 'ROT13 Cipher'
            };

            await extra.reply(
                `🔄 *${typeNames[type]}*\n\n` +
                `📝 Input: ${input.length > 200 ? input.slice(0, 200) + '...' : input}\n\n` +
                `✨ Output: ${result.length > 1000 ? result.slice(0, 1000) + '...' : result}`
            );

        } catch (error) {
            console.error('[CONVERT ERROR]', error);
            await extra.reply('❌ Error converting.');
        }
    }
};
