/**
 * @file handler.js
 * @description Main message handler for EDBOTS with High-Grade Anti-Ban and AI integration.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { addMessage } = require('../utils/groupstats');
const antiBan = require('../utils/antiBan');
const { askAI } = require('../utils/aiEngine');

// Group metadata cache
const groupMetadataCache = new Map();
const CACHE_TTL = 60000; // 1 minute

/**
 * Unwrap WhatsApp containers
 */
const getMessageContent = (msg) => {
    if (!msg || !msg.message) return null;
    let m = msg.message;
    
    if (m.ephemeralMessage) m = m.ephemeralMessage.message;
    if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message;
    if (m.viewOnceMessageV2Extension) m = m.viewOnceMessageV2Extension.message;
    if (m.viewOnceMessage) m = m.viewOnceMessage.message;
    if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message;
    
    return m;
};

/**
 * Cached group metadata getter
 */
const getGroupMetadata = async (sock, groupId) => {
    const now = Date.now();
    const cached = groupMetadataCache.get(groupId);
    if (cached && now - cached.timestamp < CACHE_TTL) return cached.metadata;
    try {
        const metadata = await sock.groupMetadata(groupId);
        groupMetadataCache.set(groupId, { metadata, timestamp: now });
        return metadata;
    } catch (e) {
        return null;
    }
};

/**
 * Normalizes phone numbers
 */
const normalizeNumber = (jid) => {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
};

/**
 * Checks if sender is owner
 */
const isOwner = (sender) => {
    if (!sender) return false;
    const senderNumber = normalizeNumber(sender.split('@')[0]);
    const owners = (config.owner || []).map(owner => normalizeNumber(owner));
    return owners.includes(senderNumber);
};

/**
 * Checks if JID is system/broadcast
 */
const isSystemJid = (jid) => {
    if (!jid) return true;
    return jid.includes('@broadcast') || jid.includes('status.broadcast') || jid.includes('@newsletter');
};

/**
 * Checks if sender is admin
 */
const isAdmin = async (sock, sender, groupId, metadata) => {
    if (!metadata) return false;
    return metadata.participants.some(p => p.id === sender && p.admin !== null);
};

/**
 * Checks if bot is admin
 */
const isBotAdmin = async (sock, groupId, metadata) => {
    if (!metadata) return false;
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    return metadata.participants.some(p => p.id === botJid && p.admin !== null);
};

/**
 * Main Message Handler
 */
const handleMessage = async (sock, msg, commands) => {
    try {
        const from = msg.key.remoteJid;
        if (!msg.message || isSystemJid(from)) return;

        const content = getMessageContent(msg);
        if (!content) return;

        const sender = msg.key.fromMe ? (sock.user.id.split(':')[0] + '@s.whatsapp.net') : (msg.key.participant || from);
        const isGroup = from.endsWith('@g.us');
        const groupMetadata = isGroup ? await getGroupMetadata(sock, from) : null;

        let body = content.conversation || content.extendedTextMessage?.text || content.imageMessage?.caption || content.videoMessage?.caption || '';
        body = body.trim();
        
        const isReply = !!(content.extendedTextMessage?.contextInfo?.quotedMessage);
        
        // Anti-Ban: Determine if we should respond
        const prefix = config.prefix || '.';
        const isCmd = body.startsWith(prefix);
        if (!(await antiBan.shouldRespond(from, isCmd))) return;

        if (!body && !isReply) return;

        const context = {
            from, sender, isGroup, groupMetadata, body,
            isOwner: isOwner(sender),
            isAdmin: isGroup ? await isAdmin(sock, sender, from, groupMetadata) : false,
            isBotAdmin: isGroup ? await isBotAdmin(sock, from, groupMetadata) : false,
            commands,
            prefix,
            reply: async (text) => {
                await antiBan.simulateHumanBehavior(sock, from, text);
                return sock.sendMessage(from, { text }, { quoted: msg });
            }
        };

        // Group Logic
        if (isGroup && addMessage) {
            addMessage(from, sender);
        }

        // Command Processing
        if (isCmd) {
            const args = body.slice(prefix.length).trim().split(/\s+/);
            const commandName = args.shift().toLowerCase();

            if (!commandName) return;

            const command = commands.get(commandName);
            
            if (command) {
                // Permission checks
                if (command.ownerOnly && !context.isOwner) return context.reply(config.messages.ownerOnly);
                if (command.groupOnly && !context.isGroup) return context.reply(config.messages.groupOnly);
                if (command.adminOnly && !context.isAdmin && !context.isOwner) return context.reply(config.messages.adminOnly);

                try {
                    await command.execute(sock, msg, args, context);
                } catch (cmdError) {
                    console.error(`[COMMAND ERROR] ${commandName}:`, cmdError);
                    context.reply('❌ An internal error occurred while executing this command.');
                }
                return; // End command processing
            }
        }

        // --- AI Auto Reply & Shortcut Logic ---

        // AI shortcut: "ai: question"
        if (body.toLowerCase().startsWith('ai:')) {
            const question = body.slice(3).trim();
            const answer = await askAI(question);
            if (answer && answer !== "NOT_CONNECTED") {
                return await context.reply(answer);
            }
        }

        // Global AI Auto Reply (Private chats only to avoid ban)
        if (config.autoReply && !isGroup && !msg.key.fromMe && !isCmd) {
            const answer = await askAI(body);
            if (answer && answer !== "NOT_CONNECTED") {
                return await context.reply(answer);
            }
        }

    } catch (e) {
        console.error('[HANDLER ERROR]', e);
    }
};

module.exports = {
    handleMessage
};
