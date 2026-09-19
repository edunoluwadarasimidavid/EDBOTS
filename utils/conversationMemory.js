/**
 * @file conversationMemory.js
 * @description Smart conversation memory system.
 * Tracks user preferences, conversation context, and interaction history.
 * Makes the bot feel intelligent and personalized.
 */

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '../data/memory');
const PROFILES_FILE = path.join(MEMORY_DIR, 'userProfiles.json');
const CONVERSATIONS_FILE = path.join(MEMORY_DIR, 'conversations.json');
const KNOWLEDGE_FILE = path.join(MEMORY_DIR, 'knowledgeBase.json');

// Ensure memory directory exists
if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

// ============================================================
// USER PROFILES - Track user preferences and personality
// ============================================================
function loadProfiles() {
    try {
        if (!fs.existsSync(PROFILES_FILE)) return {};
        return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
    } catch (e) { return {}; }
}

function saveProfiles(data) {
    try {
        fs.writeFileSync(PROFILES_FILE, JSON.stringify(data, null, 2));
    } catch (e) { console.error('[Memory] Profile save error:', e); }
}

/**
 * Get or create user profile
 */
function getUserProfile(userId) {
    const profiles = loadProfiles();
    if (!profiles[userId]) {
        profiles[userId] = {
            name: null,
            language: 'en',
            interests: [],
            mood: 'neutral',
            interactionCount: 0,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            preferredResponseStyle: 'casual', // casual, formal, fun
            topics: {}, // topic -> count
            favoriteCommands: {},
            notes: [] // owner notes about user
        };
        saveProfiles(profiles);
    }
    return profiles[userId];
}

/**
 * Update user profile with new data
 */
function updateUserProfile(userId, updates) {
    const profiles = loadProfiles();
    if (!profiles[userId]) getUserProfile(userId);
    profiles[userId] = { ...profiles[userId], ...updates, lastSeen: Date.now() };
    saveProfiles(profiles);
    return profiles[userId];
}

/**
 * Track user interaction
 */
function trackInteraction(userId, command, message) {
    const profile = getUserProfile(userId);
    profile.interactionCount++;
    profile.lastSeen = Date.now();

    // Track command usage
    if (command) {
        profile.favoriteCommands[command] = (profile.favoriteCommands[command] || 0) + 1;
    }

    // Track topics from message
    if (message) {
        const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        words.forEach(word => {
            profile.topics[word] = (profile.topics[word] || 0) + 1;
        });
    }

    saveProfiles(loadProfiles());
}

/**
 * Detect user's preferred language from text
 */
function detectLanguage(text) {
    const langPatterns = {
        'es': /\b(hola|gracias|por favor|cómo|qué|buenos|buenas)\b/i,
        'fr': /\b(bonjour|merci|s'il|comment|quoi|bonsoir)\b/i,
        'de': /\b(hallo|danke|bitte|wie|was|guten)\b/i,
        'pt': /\b(olá|obrigado|por favor|como|oi|bom)\b/i,
        'it': /\b(ciao|grazie|per favore|come|buongiorno)\b/i,
        'ja': /[\u3040-\u309F\u30A0-\u30FF]/,
        'ko': /[\uAC00-\uD7AF]/,
        'zh': /[\u4E00-\u9FFF]/,
        'ar': /[\u0600-\u06FF]/,
        'hi': /[\u0900-\u097F]/,
        'ru': /[\u0400-\u04FF]/,
        'sw': /\b(habari|asante|ndiyo|la|karibu)\b/i
    };

    for (const [lang, pattern] of Object.entries(langPatterns)) {
        if (pattern.test(text)) return lang;
    }
    return 'en';
}

/**
 * Analyze message sentiment
 */
function analyzeSentiment(text) {
    const positive = /\b(good|great|awesome|love|happy|thanks|thank|perfect|amazing|excellent|wonderful|fantastic|beautiful|nice|best|cool|yes|yay|lol|haha|😊|😄|❤️|👍|🎉|✨)\b/i;
    const negative = /\b(bad|terrible|hate|angry|sad|annoying|worst|ugly|stupid|no|never|ugh|😢|😡|👎|💔|😞)\b/i;
    const question = /\?$/;

    const posMatches = (text.match(positive) || []).length;
    const negMatches = (text.match(negative) || []).length;

    if (posMatches > negMatches) return 'positive';
    if (negMatches > posMatches) return 'negative';
    if (question.test(text)) return 'question';
    return 'neutral';
}

/**
 * Detect user's mood from conversation
 */
function detectMood(userId, recentMessages = []) {
    if (recentMessages.length === 0) return 'neutral';

    let positiveCount = 0;
    let negativeCount = 0;

    recentMessages.forEach(msg => {
        const sentiment = analyzeSentiment(msg);
        if (sentiment === 'positive') positiveCount++;
        if (sentiment === 'negative') negativeCount++;
    });

    if (positiveCount > negativeCount * 2) return 'happy';
    if (negativeCount > positiveCount * 2) return 'frustrated';
    if (positiveCount > 0 && negativeCount > 0) return 'mixed';
    return 'neutral';
}

// ============================================================
// CONVERSATION CONTEXT - Track recent conversations
// ============================================================
function loadConversations() {
    try {
        if (!fs.existsSync(CONVERSATIONS_FILE)) return {};
        return JSON.parse(fs.readFileSync(CONVERSATIONS_FILE, 'utf8'));
    } catch (e) { return {}; }
}

function saveConversations(data) {
    try {
        fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(data, null, 2));
    } catch (e) { console.error('[Memory] Conversation save error:', e); }
}

/**
 * Add message to conversation history
 */
function addToHistory(chatId, userId, message, isBot = false) {
    const convs = loadConversations();
    if (!convs[chatId]) convs[chatId] = { messages: [], context: null };

    convs[chatId].messages.push({
        userId,
        text: message.slice(0, 500), // Limit stored length
        isBot,
        timestamp: Date.now()
    });

    // Keep only last 50 messages per chat
    if (convs[chatId].messages.length > 50) {
        convs[chatId].messages = convs[chatId].messages.slice(-50);
    }

    saveConversations(convs);
}

/**
 * Get recent conversation context for AI
 */
function getConversationContext(chatId, limit = 10) {
    const convs = loadConversations();
    if (!convs[chatId]) return '';

    const recent = convs[chatId].messages.slice(-limit);
    return recent.map(m => {
        const role = m.isBot ? 'Assistant' : 'User';
        return `${role}: ${m.text}`;
    }).join('\n');
}

/**
 * Set conversation context/topic
 */
function setConversationContext(chatId, topic) {
    const convs = loadConversations();
    if (!convs[chatId]) convs[chatId] = { messages: [], context: null };
    convs[chatId].context = {
        topic,
        setAt: Date.now()
    };
    saveConversations(convs);
}

// ============================================================
// KNOWLEDGE BASE - Store and retrieve information
// ============================================================
function loadKnowledge() {
    try {
        if (!fs.existsSync(KNOWLEDGE_FILE)) return { entries: {}, categories: {} };
        return JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf8'));
    } catch (e) { return { entries: {}, categories: {} }; }
}

function saveKnowledge(data) {
    try {
        fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(data, null, 2));
    } catch (e) { console.error('[Memory] Knowledge save error:', e); }
}

/**
 * Store a knowledge entry
 */
function storeKnowledge(key, value, category = 'general', userId = null) {
    const kb = loadKnowledge();
    kb.entries[key.toLowerCase()] = {
        value,
        category,
        storedBy: userId,
        storedAt: Date.now(),
        accessCount: 0
    };
    if (!kb.categories[category]) kb.categories[category] = [];
    if (!kb.categories[category].includes(key.toLowerCase())) {
        kb.categories[category].push(key.toLowerCase());
    }
    saveKnowledge(kb);
}

/**
 * Search knowledge base
 */
function searchKnowledge(query) {
    const kb = loadKnowledge();
    const lower = query.toLowerCase();
    const results = [];

    for (const [key, entry] of Object.entries(kb.entries)) {
        if (key.includes(lower) || entry.value.toLowerCase().includes(lower)) {
            entry.accessCount++;
            results.push({ key, ...entry });
        }
    }

    saveKnowledge(kb);
    return results.sort((a, b) => b.accessCount - a.accessCount).slice(0, 5);
}

/**
 * Get knowledge by category
 */
function getKnowledgeByCategory(category) {
    const kb = loadKnowledge();
    const keys = kb.categories[category] || [];
    return keys.map(k => ({ key: k, ...kb.entries[k] }));
}

// ============================================================
// SMART RESPONSES - Context-aware responses
// ============================================================

/**
 * Generate a context-aware greeting
 */
function getSmartGreeting(userId, timeOfDay) {
    const profile = getUserProfile(userId);
    const name = profile.name || 'there';
    const hour = new Date().getHours();

    let greeting;
    if (hour < 6) greeting = `Still up, ${name}? 🌙`;
    else if (hour < 12) greeting = `Good morning, ${name}! ☀️`;
    else if (hour < 17) greeting = `Good afternoon, ${name}! 🌤️`;
    else if (hour < 21) greeting = `Good evening, ${name}! 🌅`;
    else greeting = `Good night, ${name}! 🌙`;

    // Add personal touch based on interaction history
    if (profile.interactionCount > 100) {
        greeting += `\nGreat to see you again! 🎉`;
    } else if (profile.interactionCount > 10) {
        greeting += `\nWelcome back! 👋`;
    }

    return greeting;
}

/**
 * Get smart response style based on user profile
 */
function getResponseStyle(userId) {
    const profile = getUserProfile(userId);
    return profile.preferredResponseStyle || 'casual';
}

/**
 * Clean up old conversation data (older than 7 days)
 */
function cleanupOldData() {
    const convs = loadConversations();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    let cleaned = 0;
    for (const chatId of Object.keys(convs)) {
        convs[chatId].messages = convs[chatId].messages.filter(m => m.timestamp > sevenDaysAgo);
        if (convs[chatId].messages.length === 0) {
            delete convs[chatId];
            cleaned++;
        }
    }
    if (cleaned > 0) saveConversations(convs);
}

module.exports = {
    // Profiles
    getUserProfile,
    updateUserProfile,
    trackInteraction,
    detectLanguage,
    analyzeSentiment,
    detectMood,
    // Conversations
    addToHistory,
    getConversationContext,
    setConversationContext,
    // Knowledge
    storeKnowledge,
    searchKnowledge,
    getKnowledgeByCategory,
    // Smart responses
    getSmartGreeting,
    getResponseStyle,
    // Maintenance
    cleanupOldData
};
