/**
 * @file aiProviders.js
 * @description Multi-provider AI service with free API fallbacks.
 * Supports: Groq (free), HuggingFace (free), SambaNova (free), Puter AI
 * No paid API keys required - uses free tiers and public endpoints.
 */

const axios = require('axios');

// ============================================================
// PROVIDER 1: GROQ (Fastest free inference)
// Free tier: 30 req/min, Llama 3.1 8B, Mixtral 8x7B
// Sign up: https://console.groq.com (free, no credit card)
// ============================================================
const GROQ_MODELS = [
    'llama-3.1-8b-instant',
    'llama3-70b-8192',
    'mixtral-8x7b-32768',
    'gemma2-9b-it'
];

async function groqChat(text, systemPrompt = '', apiKey = process.env.GROQ_API_KEY) {
    if (!apiKey) return null;
    try {
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: text });

        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.1-8b-instant',
            messages,
            max_tokens: 1024,
            temperature: 0.7
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 15000
        });

        return res.data.choices?.[0]?.message?.content || null;
    } catch (e) {
        console.error('[AI-Groq]', e.message);
        return null;
    }
}

// ============================================================
// PROVIDER 2: HUGGING FACE INFERENCE API (Free)
// Free tier: 3000 req/day, many models available
// No API key needed for some models, or free signup
// ============================================================
async function huggingFaceChat(text, systemPrompt = '', apiKey = process.env.HF_API_KEY) {
    try {
        const prompt = systemPrompt
            ? `<|system|>\n${systemPrompt}\n<|user|>\n${text}\n<|assistant|>`
            : text;

        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const res = await axios.post(
            'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3',
            { inputs: prompt, parameters: { max_new_tokens: 512, temperature: 0.7, return_full_text: false } },
            { headers, timeout: 30000 }
        );

        const output = Array.isArray(res.data) ? res.data[0]?.generated_text : res.data?.generated_text;
        return output || null;
    } catch (e) {
        console.error('[AI-HF]', e.message);
        return null;
    }
}

// ============================================================
// PROVIDER 3: SAMBANOVA (Fast free inference)
// Free tier: Very generous, Llama 3.1 8B
// Sign up: https://cloud.sambanova.ai (free)
// ============================================================
async function sambaNovaChat(text, systemPrompt = '', apiKey = process.env.SAMBANOVA_API_KEY) {
    if (!apiKey) return null;
    try {
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: text });

        const res = await axios.post('https://api.sambanova.ai/v1/chat/completions', {
            model: 'Meta-Llama-3.1-8B-Instruct',
            messages,
            max_tokens: 1024,
            temperature: 0.7
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 15000
        });

        return res.data.choices?.[0]?.message?.content || null;
    } catch (e) {
        console.error('[AI-Samba]', e.message);
        return null;
    }
}

// ============================================================
// PROVIDER 4: OPENROUTER (Many free models)
// Free tier: Many free models including Llama, Mistral, Phi
// Sign up: https://openrouter.ai (free credits on signup)
// ============================================================
async function openRouterChat(text, systemPrompt = '', apiKey = process.env.OPENROUTER_API_KEY) {
    if (!apiKey) return null;
    try {
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: text });

        const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'meta-llama/llama-3.1-8b-instruct:free',
            messages,
            max_tokens: 1024,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://edbots.ai',
                'X-Title': 'EDBOTS AI'
            },
            timeout: 15000
        });

        return res.data.choices?.[0]?.message?.content || null;
    } catch (e) {
        console.error('[AI-OpenRouter]', e.message);
        return null;
    }
}

// ============================================================
// PROVIDER 5: FREE NO-KEY ENDPOINTS (Fallbacks)
// These work without any API key
// ============================================================

// Free text generation via HuggingFace free inference (no key)
async function freeTextGen(text) {
    try {
        const res = await axios.post(
            'https://api-inference.huggingface.co/models/gpt2',
            { inputs: text, parameters: { max_new_tokens: 200, temperature: 0.8 } },
            { headers: { 'Content-Type': 'application/json' }, timeout: 20000 }
        );
        const output = Array.isArray(res.data) ? res.data[0]?.generated_text : '';
        return output || null;
    } catch (e) {
        return null;
    }
}

// ============================================================
// MAIN CHAT FUNCTION - Tries providers in order
// ============================================================
const SYSTEM_PROMPTS = {
    personal: 'You are EDBOTS AI, a friendly, helpful, and witty WhatsApp assistant. Keep responses concise and natural. Use emojis sparingly. Be conversational like a real friend.',
    business: 'You are EDBOTS AI Business Assistant. You help with professional communication, business planning, marketing strategies, customer support templates, and professional advice. Be professional, clear, and actionable.',
    group: 'You are EDBOTS AI, a helpful group assistant. Keep responses brief and relevant. Help with group discussions, answer questions, and keep the conversation fun.',
    customer: 'You are a professional customer service representative. Be polite, helpful, and resolve issues quickly. Use professional language.',
    marketing: 'You are a marketing expert AI. Help create compelling content, social media posts, ad copy, and marketing strategies. Be creative and data-driven.'
};

/**
 * Main AI chat function - tries multiple providers with automatic fallback
 * @param {string} text - User message
 * @param {string} mode - 'personal', 'business', 'group', 'customer', 'marketing'
 * @param {Object} options - { userId, groupName, conversationHistory }
 * @returns {string|null} AI response or null
 */
async function aiChat(text, mode = 'personal', options = {}) {
    const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.personal;

    // Try providers in order (fastest to slowest)
    const providers = [
        { name: 'Groq', fn: () => groqChat(text, systemPrompt) },
        { name: 'SambaNova', fn: () => sambaNovaChat(text, systemPrompt) },
        { name: 'OpenRouter', fn: () => openRouterChat(text, systemPrompt) },
        { name: 'HuggingFace', fn: () => huggingFaceChat(text, systemPrompt) },
    ];

    for (const provider of providers) {
        try {
            const result = await provider.fn();
            if (result && result.length > 5) {
                console.log(`[AI] Response from ${provider.name}`);
                return result;
            }
        } catch (e) {
            continue;
        }
    }

    // Ultimate fallback - local simple responses
    return null;
}

/**
 * AI-powered features
 */
async function aiTranslate(text, targetLang) {
    const prompt = `Translate the following text to ${targetLang}. Only return the translation, nothing else:\n\n${text}`;
    return aiChat(prompt, 'personal');
}

async function aiSummarize(text) {
    const prompt = `Summarize the following text in 2-3 sentences:\n\n${text}`;
    return aiChat(prompt, 'personal');
}

async function aiProofread(text) {
    const prompt = `Proofread and correct the following text. Return the corrected version with any changes noted:\n\n${text}`;
    return aiChat(prompt, 'personal');
}

async function aiGenerateBusinessContent(type, topic) {
    const prompts = {
        'social': `Create an engaging social media post about: ${topic}. Include relevant emojis and hashtags. Keep it under 280 characters.`,
        'email': `Write a professional email about: ${topic}. Include subject line, greeting, body, and closing.`,
        'ad': `Create a compelling advertisement copy for: ${topic}. Make it catchy and action-oriented.`,
        'bio': `Write a professional business bio about: ${topic}. Keep it under 150 words.`,
        'review': `Write a professional business review template for: ${topic}.`
    };
    const prompt = prompts[type] || prompts['social'];
    return aiChat(prompt, 'business');
}

async function aiCustomerSupport(query, productName = 'our product') {
    const prompt = `A customer is asking about ${productName}: "${query}"\n\nProvide a helpful, professional customer support response. Be empathetic and solution-oriented.`;
    return aiChat(prompt, 'customer');
}

module.exports = {
    aiChat,
    aiTranslate,
    aiSummarize,
    aiProofread,
    aiGenerateBusinessContent,
    aiCustomerSupport,
    SYSTEM_PROMPTS,
    // Export individual providers for direct use
    groqChat,
    huggingFaceChat,
    sambaNovaChat,
    openRouterChat
};
