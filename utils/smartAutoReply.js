/**
 * @file smartAutoReply.js
 * @description Advanced AI-Powered Auto-Reply System with Keyword Learning.
 * 
 * Features:
 * - Case-sensitive keyword matching
 * - AI-powered response generation
 * - Learning from conversations (stores patterns)
 * - Context-aware replies
 * - Fallback to AI when no keyword matches
 * - Business hours awareness
 * - Sentiment analysis
 */

const fs = require('fs');
const path = require('path');
const { askAI } = require('./aiEngine');

const AUTOREPLY_DATA_FILE = path.join(__dirname, '../data/smartAutoReply.json');

class SmartAutoReply {
    constructor() {
        this.data = this.load();
        this.ensureDirectory();
    }

    ensureDirectory() {
        const dir = path.dirname(AUTOREPLY_DATA_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(AUTOREPLY_DATA_FILE)) {
            fs.writeFileSync(AUTOREPLY_DATA_FILE, JSON.stringify({}, null, 2));
        }
    }

    load() {
        try {
            if (!fs.existsSync(AUTOREPLY_DATA_FILE)) return {};
            return JSON.parse(fs.readFileSync(AUTOREPLY_DATA_FILE, 'utf8'));
        } catch (e) {
            return {};
        }
    }

    save() {
        try {
            fs.writeFileSync(AUTOREPLY_DATA_FILE, JSON.stringify(this.data, null, 2));
        } catch (e) {
            console.error('[SmartAutoReply] Save error:', e);
        }
    }

    /**
     * Get or initialize chat auto-reply config
     */
    getConfig(chatId) {
        if (!this.data[chatId]) {
            this.data[chatId] = {
                enabled: false,
                keywords: {},           // { "keyword": { response: "...", caseSensitive: true, count: 0, lastUsed: null } }
                patterns: [],           // [{ pattern: "regex", response: "...", priority: 0 }]
                learnedResponses: {},   // AI-learned responses: { "input_hash": { input: "...", response: "...", useCount: 0 } }
                fallbackToAI: true,     // Use AI when no keyword matches
                maxLearnedResponses: 100,
                totalReplies: 0,
                lastReplyTime: null,
                createdAt: new Date().toISOString()
            };
        }
        return this.data[chatId];
    }

    /**
     * Add a keyword-response pair (case-sensitive)
     */
    addKeyword(chatId, keyword, response, caseSensitive = true) {
        const config = this.getConfig(chatId);
        config.keywords[keyword] = {
            response,
            caseSensitive,
            count: 0,
            lastUsed: null,
            createdAt: new Date().toISOString()
        };
        this.save();
        return true;
    }

    /**
     * Remove a keyword
     */
    removeKeyword(chatId, keyword) {
        const config = this.getConfig(chatId);
        if (config.keywords[keyword]) {
            delete config.keywords[keyword];
            this.save();
            return true;
        }
        return false;
    }

    /**
     * Match incoming message against keywords (case-sensitive)
     * Returns the response if matched, null otherwise
     */
    matchKeyword(chatId, message) {
        const config = this.getConfig(chatId);
        
        // Exact match first (case-sensitive)
        for (const [keyword, data] of Object.entries(config.keywords)) {
            if (data.caseSensitive) {
                if (message.includes(keyword)) {
                    data.count++;
                    data.lastUsed = new Date().toISOString();
                    this.save();
                    return data.response;
                }
            }
        }

        // Then case-insensitive match
        const lowerMessage = message.toLowerCase();
        for (const [keyword, data] of Object.entries(config.keywords)) {
            if (!data.caseSensitive) {
                if (lowerMessage.includes(keyword.toLowerCase())) {
                    data.count++;
                    data.lastUsed = new Date().toISOString();
                    this.save();
                    return data.response;
                }
            }
        }

        return null;
    }

    /**
     * Learn from a conversation (stores input-response pairs)
     */
    learn(chatId, input, response) {
        const config = this.getConfig(chatId);
        
        // Hash the input for deduplication
        const hash = this.simpleHash(input.toLowerCase().trim());
        
        if (!config.learnedResponses[hash]) {
            // Check limit
            if (Object.keys(config.learnedResponses).length >= config.maxLearnedResponses) {
                // Remove least used
                const sorted = Object.entries(config.learnedResponses)
                    .sort((a, b) => a[1].useCount - b[1].useCount);
                delete config.learnedResponses[sorted[0][0]];
            }
            
            config.learnedResponses[hash] = {
                input: input.trim(),
                response: response.trim(),
                useCount: 0,
                createdAt: new Date().toISOString()
            };
        } else {
            config.learnedResponses[hash].useCount++;
        }
        
        this.save();
    }

    /**
     * Check if we've learned a response to similar input
     */
    getLearnedResponse(chatId, input) {
        const config = this.getConfig(chatId);
        const hash = this.simpleHash(input.toLowerCase().trim());
        
        if (config.learnedResponses[hash]) {
            config.learnedResponses[hash].useCount++;
            this.save();
            return config.learnedResponses[hash].response;
        }
        
        return null;
    }

    /**
     * Main process function - handles incoming message
     */
    async processMessage(chatId, message, bizConfig = {}) {
        const config = this.getConfig(chatId);
        
        if (!config.enabled) return null;

        // 1. Try keyword match (case-sensitive)
        const keywordResponse = this.matchKeyword(chatId, message);
        if (keywordResponse) {
            config.totalReplies++;
            config.lastReplyTime = new Date().toISOString();
            this.save();
            return {
                type: 'keyword',
                response: keywordResponse,
                confidence: 1.0
            };
        }

        // 2. Try learned responses
        const learnedResponse = this.getLearnedResponse(chatId, message);
        if (learnedResponse) {
            config.totalReplies++;
            config.lastReplyTime = new Date().toISOString();
            this.save();
            return {
                type: 'learned',
                response: learnedResponse,
                confidence: 0.8
            };
        }

        // 3. Fallback to AI if enabled
        if (config.fallbackToAI) {
            try {
                // Build context for AI
                const aiContext = this.buildAIContext(chatId, message, bizConfig);
                const aiResponse = await askAI(aiContext, 'business');
                
                if (aiResponse && !aiResponse.startsWith('⚠️') && !aiResponse.startsWith('❌')) {
                    // Learn from this interaction
                    this.learn(chatId, message, aiResponse);
                    
                    config.totalReplies++;
                    config.lastReplyTime = new Date().toISOString();
                    this.save();
                    
                    return {
                        type: 'ai',
                        response: aiResponse,
                        confidence: 0.6
                    };
                }
            } catch (aiError) {
                console.error('[SmartAutoReply] AI fallback error:', aiError.message);
            }
        }

        return null;
    }

    /**
     * Build AI context with business info
     */
    buildAIContext(chatId, message, bizConfig) {
        let context = `You are a professional business assistant. `;
        
        if (bizConfig.businessHours) {
            context += `Business hours: ${bizConfig.businessHours}. `;
        }
        
        if (bizConfig.greetingMessage) {
            context += `Greeting style: ${bizConfig.greetingMessage}. `;
        }
        
        context += `Respond professionally and helpfully to this customer message: "${message}"`;
        
        return context;
    }

    /**
     * Simple hash function for deduplication
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Enable auto-reply for a chat
     */
    enable(chatId) {
        const config = this.getConfig(chatId);
        config.enabled = true;
        this.save();
    }

    /**
     * Disable auto-reply for a chat
     */
    disable(chatId) {
        const config = this.getConfig(chatId);
        config.enabled = false;
        this.save();
    }

    /**
     * Get status/stats for a chat
     */
    getStatus(chatId) {
        const config = this.getConfig(chatId);
        const keywordCount = Object.keys(config.keywords).length;
        const learnedCount = Object.keys(config.learnedResponses).length;
        
        return {
            enabled: config.enabled,
            keywordCount,
            learnedCount,
            totalReplies: config.totalReplies,
            lastReplyTime: config.lastReplyTime,
            fallbackToAI: config.fallbackToAI
        };
    }

    /**
     * Get top keywords by usage
     */
    getTopKeywords(chatId, limit = 10) {
        const config = this.getConfig(chatId);
        return Object.entries(config.keywords)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, limit)
            .map(([keyword, data]) => ({
                keyword,
                count: data.count,
                response: data.response.substring(0, 50)
            }));
    }
}

module.exports = new SmartAutoReply();
