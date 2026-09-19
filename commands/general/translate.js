/**
 * Advanced Translate Command - Auto-detect language, translate to any language
 * Supports 100+ languages with natural translations
 */

const { aiChat } = require('../../utils/aiProviders');

const LANGUAGES = {
    'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
    'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese',
    'ko': 'Korean', 'zh': 'Chinese', 'ar': 'Arabic', 'hi': 'Hindi',
    'bn': 'Bengali', 'pa': 'Punjabi', 'tr': 'Turkish', 'nl': 'Dutch',
    'sv': 'Swedish', 'da': 'Danish', 'no': 'Norwegian', 'fi': 'Finnish',
    'pl': 'Polish', 'cs': 'Czech', 'sk': 'Slovak', 'hu': 'Hungarian',
    'ro': 'Romanian', 'bg': 'Bulgarian', 'hr': 'Croatian', 'sr': 'Serbian',
    'uk': 'Ukrainian', 'el': 'Greek', 'th': 'Thai', 'vi': 'Vietnamese',
    'id': 'Indonesian', 'ms': 'Malay', 'tl': 'Filipino', 'sw': 'Swahili',
    'he': 'Hebrew', 'fa': 'Persian', 'ur': 'Urdu', 'ta': 'Tamil',
    'te': 'Telugu', 'ml': 'Malayalam', 'kn': 'Kannada', 'gu': 'Gujarati',
    'mr': 'Marathi', 'ne': 'Nepali', 'si': 'Sinhala', 'my': 'Myanmar',
    'ka': 'Georgian', 'am': 'Amharic', 'yo': 'Yoruba', 'ig': 'Igbo',
    'ha': 'Hausa', 'zu': 'Zulu', 'af': 'Afrikaans', 'sq': 'Albanian',
    'et': 'Estonian', 'lv': 'Latvian', 'lt': 'Lithuanian', 'mt': 'Maltese',
    'cy': 'Welsh', 'ga': 'Irish', 'is': 'Icelandic', 'mk': 'Macedonian',
    'bs': 'Bosnian', 'ca': 'Catalan', 'eu': 'Basque', 'gl': 'Galician'
};

module.exports = {
    name: 'translate',
    aliases: ['tr', 'trt', 'lang'],
    category: 'utility',
    description: 'Translate text to any language with auto-detection',
    usage: '.translate <text> <lang> or reply to a message',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                const langList = Object.entries(LANGUAGES).slice(0, 20).map(([k, v]) => `${k} - ${v}`).join('\n');
                return extra.reply(
                    `🌐 *Advanced Translator*\n\n` +
                    `*Usage:*\n` +
                    `• \`.translate <text> <lang>\` - Translate to language\n` +
                    `• Reply to a message with \`.translate <lang>\`\n` +
                    `• \`.translate auto <text>\` - Auto-detect and translate to English\n\n` +
                    `*Languages (${Object.keys(LANGUAGES).length}+):*\n${langList}\n...and more!\n\n` +
                    `*Examples:*\n` +
                    `• \`.translate Hello world es\`\n` +
                    `• \`.translate Hola mundo en\`\n` +
                    `• \`.translate auto こんにちは\``
                );
            }

            let textToTranslate = '';
            let targetLang = '';

            // Check for quoted message
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted) {
                textToTranslate = quoted.conversation ||
                    quoted.extendedTextMessage?.text ||
                    quoted.imageMessage?.caption ||
                    quoted.videoMessage?.caption || '';
                targetLang = args[0]?.toLowerCase();
            } else if (args[0]?.toLowerCase() === 'auto') {
                // Auto-detect mode
                textToTranslate = args.slice(1).join(' ');
                targetLang = 'en';
            } else {
                // Normal mode: text then language
                targetLang = args[args.length - 1]?.toLowerCase();
                textToTranslate = args.slice(0, -1).join(' ');

                // Validate language code
                if (!LANGUAGES[targetLang] && targetLang.length === 2) {
                    return extra.reply(`❌ Unknown language code "${targetLang}". Use \`.translate\` to see supported languages.`);
                }
            }

            if (!textToTranslate) {
                return extra.reply('❌ No text to translate. Provide text or reply to a message.');
            }

            if (!targetLang) {
                return extra.reply('❌ Please specify a target language (e.g., `es`, `fr`, `de`).');
            }

            await extra.reply(`🌐 Translating to ${LANGUAGES[targetLang] || targetLang}...`);

            // Use AI for natural translation
            const prompt = `Translate the following text to ${LANGUAGES[targetLang] || targetLang}. Only return the translation, nothing else:\n\n${textToTranslate}`;
            const result = await aiChat(prompt, 'personal');

            if (result && result.length > 3) {
                // Clean up the result (remove quotes, "Translation:" prefix, etc.)
                let cleanResult = result
                    .replace(/^["']|["']$/g, '')
                    .replace(/^(Translation|Here's the translation|The translation is)[:\s]*/i, '')
                    .trim();

                await extra.reply(
                    `🌐 *Translation*\n\n` +
                    `📝 Original: ${textToTranslate}\n` +
                    `🔤 ${LANGUAGES[targetLang] || targetLang}: ${cleanResult}`
                );
            } else {
                // Fallback to free translation API
                try {
                    const axios = require('axios');
                    const res = await axios.get(
                        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=auto|${targetLang}`,
                        { timeout: 10000 }
                    );
                    if (res.data?.responseData?.translatedText) {
                        await extra.reply(
                            `🌐 *Translation*\n\n` +
                            `📝 Original: ${textToTranslate}\n` +
                            `🔤 ${LANGUAGES[targetLang] || targetLang}: ${res.data.responseData.translatedText}`
                        );
                    } else {
                        await extra.reply('❌ Translation failed. Please try again.');
                    }
                } catch (e) {
                    await extra.reply('❌ Translation service unavailable.');
                }
            }

        } catch (error) {
            console.error('[TRANSLATE ERROR]', error);
            await extra.reply('❌ Translation error.');
        }
    }
};
