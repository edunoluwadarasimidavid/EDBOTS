/**
 * Reverse Text Command
 * Reverse any text sent to the bot
 */

module.exports = {
    name: 'reverse',
    aliases: ['backwards', 'flip'],
    category: 'utility',
    description: 'Reverse text or reply to a message',
    usage: '.reverse <text> or reply to a message',
    
    async execute(sock, msg, args, extra) {
        try {
            let text = '';

            // Check for quoted message
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted) {
                text = quoted.conversation || 
                       quoted.extendedTextMessage?.text || 
                       quoted.imageMessage?.caption || 
                       quoted.videoMessage?.caption || '';
            } else if (args.length > 0) {
                text = args.join(' ');
            }

            if (!text) {
                return extra.reply(
                    `🔄 *Reverse Text*\n\n` +
                    `Usage: .reverse <text> or reply to a message\n\n` +
                    `Example: .reverse hello world`
                );
            }

            // Reverse the text
            const reversed = text.split('').reverse().join('');
            
            // Also create a "flipped" version
            const flipped = text.split('').map(c => {
                const flipMap = {
                    'a': 'ɐ', 'b': 'q', 'c': 'ɔ', 'd': 'p', 'e': 'ǝ',
                    'f': 'ɟ', 'g': 'ƃ', 'h': 'ɥ', 'i': 'ᴉ', 'j': 'ɾ',
                    'k': 'ʞ', 'l': 'l', 'm': 'ɯ', 'n': 'u', 'o': 'o',
                    'p': 'd', 'q': 'b', 'r': 'ɹ', 's': 's', 't': 'ʇ',
                    'u': 'n', 'v': 'ʌ', 'w': 'ʍ', 'x': 'x', 'y': 'ʎ',
                    'z': 'z', 'A': '∀', 'B': 'q', 'C': 'Ɔ', 'D': 'p',
                    'E': 'Ǝ', 'F': 'Ⅎ', 'G': '⅁', 'H': 'H', 'I': 'I',
                    'J': 'ſ', 'K': 'ʞ', 'L': '˥', 'M': 'W', 'N': 'N',
                    'O': 'O', 'P': 'Ԁ', 'Q': 'Q', 'R': 'ɹ', 'S': 'S',
                    'T': '⊥', 'U': '∩', 'V': 'Λ', 'W': 'M', 'X': 'X',
                    'Y': '⅄', 'Z': 'Z', '.': '˙', ',': '\'', '\'': ',',
                    '!': '¡', '?': '¿', '(': ')', ')': '(', '[': ']',
                    ']': '[', '{': '}', '}': '{', '<': '>', '>': '<',
                    '_': '‾', '&': '⅋', '"': ',,'
                };
                return flipMap[c] || c;
            }).reverse().join('');

            await extra.reply(
                `🔄 *Reverse Text*\n\n` +
                `📝 Original: ${text}\n` +
                `🔄 Reversed: ${reversed}\n` +
                `🙃 Flipped: ${flipped}`
            );

        } catch (error) {
            console.error('[REVERSE ERROR]', error);
            await extra.reply('❌ Error reversing text.');
        }
    }
};
