/**
 * @file handler.js
 * @description Main message handler for EDBOTS with High-Grade Anti-Ban and AI integration.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { 
    getUser, 
    isBanned, 
    isDisabled, 
    addSecurityLog,
    getGroupSettings,
    updateGroupSettings
} = require('../database');
const { addMessage } = require('../utils/groupstats');
const antiBan = require('../utils/antiBan');
const { askAI } = require('../utils/aiEngine');
const { normalizeNumber } = require('../utils/helpers');

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
    if (m.buttonsMessage) m = m.buttonsMessage;
    if (m.listMessage) m = m.listMessage;
    if (m.templateMessage) m = m.templateMessage;
    if (m.interactiveMessage) m = m.interactiveMessage;
    
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
 * Checks if sender is owner
 */
const isOwner = (sock, senderRaw, fromMe = false) => {
    if (fromMe === true) return true;
    if (!senderRaw) return false;
    
    const sender = normalizeNumber(senderRaw);
    const owner = normalizeNumber(process.env.OWNER_NUMBER || config.owner[0] || "2349160359154");
    const botNumber = normalizeNumber(sock.user.id.split(':')[0]);
    
    return sender === owner || sender === botNumber;
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

        const fromMe = msg.key.fromMe;
        const isGroup = from.endsWith('@g.us');
        
        // STEP 2 — Safe sender extraction priority
        const senderRaw = 
            msg.key.participant || 
            msg.participant || 
            msg.key.remoteJid || 
            "";
        
        const sender = normalizeNumber(senderRaw);
        
        // 0. BANNED CHECK (CRITICAL)
        if (isBanned(senderRaw)) {
            // We only reply once or silent? User asked for reply: ⛔ Access denied.
            // To avoid spamming back to banned users, we check if it was a command
            const body = (content.conversation || content.extendedTextMessage?.text || '').trim();
            if (body.startsWith(config.prefix || '.')) {
                // Return early without replying to prevent bot loops if banned person tries to spam
                return; 
            }
            return;
        }

        const ownerStatus = isOwner(sock, senderRaw, fromMe);
        const groupMetadata = isGroup ? await getGroupMetadata(sock, from) : null;

        // Enhanced Body Extraction
        const fullBody = (
            content.conversation || 
            content.extendedTextMessage?.text || 
            content.imageMessage?.caption || 
            content.videoMessage?.caption || 
            content.buttonsResponseMessage?.selectedButtonId || 
            content.listResponseMessage?.singleSelectReply?.selectedRowId || 
            content.templateButtonReplyMessage?.selectedId ||
            content.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
            ''
        ).trim();
        
        const isReply = !!(content.extendedTextMessage?.contextInfo?.quotedMessage);
        
        // Command detection
        const prefix = config.prefix || '.';
        const isCmd = fullBody.startsWith(prefix);
        
        const commandName = isCmd 
            ? fullBody.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase() 
            : null;

        const args = isCmd 
            ? fullBody.slice(prefix.length).trim().split(/\s+/).slice(1) 
            : [];

        // Safe Debug Logs
        if (isCmd || config.debug) {
            console.log(`[MSG] From: ${senderRaw} | Cmd: ${commandName || 'None'} | isOwner: ${ownerStatus} | isGroup: ${isGroup}`);
        }

        // Anti-Ban: Determine if we should respond
        const adminStatus = isGroup ? await isAdmin(sock, senderRaw, from, groupMetadata) : false;
        const isPrivileged = ownerStatus ? 'owner' : adminStatus;
        if (!(await antiBan.shouldRespond(from, isCmd, isPrivileged))) return;

        // selfMode check
        if (config.selfMode && !ownerStatus && isCmd) return;

        if (!fullBody && !isReply) return;

        const context = {
            sock,
            msg,
            from, 
            sender: senderRaw, 
            isGroup, 
            groupMetadata, 
            body: fullBody,
            isOwner: ownerStatus,
            isAdmin: adminStatus,
            isBotAdmin: isGroup ? await isBotAdmin(sock, from, groupMetadata) : false,
            commands,
            prefix,
            args,
            reply: async (text) => {
                await antiBan.simulateHumanBehavior(sock, from, text);
                return sock.sendMessage(from, { text }, { quoted: msg });
            }
        };

        // Group Logic
        if (isGroup && addMessage) {
            addMessage(from, senderRaw);
        }

        // Command Processing
        if (isCmd && commandName) {
            const command = commands.get(commandName);
            
            if (command) {
                // 🔐 GLOBAL SECURITY ENFORCEMENT

                // 1. BANNED CHECK (Redundant but safe)
                if (isBanned(senderRaw)) {
                   console.log(`[SECURITY BLOCK] Sender: ${senderRaw} Command: ${commandName} Reason: banned`);
                   return context.reply('⛔ Access denied.');
                }

                // 2. OWNER CHECK
                if (command.isOwner && !context.isOwner) {
                    addSecurityLog({ sender: senderRaw, command: commandName, reason: 'owner denied', group: from });
                    console.log(`[SECURITY BLOCK] Sender: ${senderRaw} Command: ${commandName} Reason: owner denied`);
                    return context.reply('⛔ Owner-only command.');
                }

                // 3. ADMIN CHECK
                if (command.isAdmin && !context.isAdmin && !context.isOwner) {
                    addSecurityLog({ sender: senderRaw, command: commandName, reason: 'admin denied', group: from });
                    console.log(`[SECURITY BLOCK] Sender: ${senderRaw} Command: ${commandName} Reason: admin denied`);
                    return context.reply('⛔ Admin-only command.');
                }

                // 4. GROUP CHECK
                if (command.isGroup && !context.isGroup) {
                    addSecurityLog({ sender: senderRaw, command: commandName, reason: 'group denied', group: from });
                    console.log(`[SECURITY BLOCK] Sender: ${senderRaw} Command: ${commandName} Reason: group denied`);
                    return context.reply('⛔ Group-only command.');
                }

                // 5. DISABLED COMMAND CHECK
                if (isGroup && isDisabled(from, commandName)) {
                    console.log(`[SECURITY BLOCK] Sender: ${senderRaw} Command: ${commandName} Reason: disabled in group`);
                    return context.reply('⛔ This command is disabled in this group.');
                }

                try {
                    console.log(`[SYSTEM] Executing command: ${commandName}`);
                    
                    if (typeof command.handler === 'function') {
                        await command.handler(context);
                    } else if (typeof command.execute === 'function') {
                        await command.execute(sock, msg, args, context);
                    } else {
                        console.error(`[ERROR] Command ${commandName} has no handler/execute function!`);
                    }
                    
                    console.log(`[SYSTEM] Command success: ${commandName}`);
                } catch (cmdError) {
                    console.error(`[COMMAND FAILED] ${commandName}:`, cmdError);
                    context.reply('❌ An internal error occurred while executing this command.');
                }
                return;
            } else {
                console.log(`[SYSTEM] Command NOT FOUND: ${commandName}`);
            }
        }

        // AI Logic...
        if (fullBody.toLowerCase().startsWith('ai:')) {
            const question = fullBody.slice(3).trim();
            const answer = await askAI(question);
            if (answer && answer !== "NOT_CONNECTED") {
                return await context.reply(answer);
            }
        }

        if (config.autoReply && !isGroup && !isCmd && !fromMe) {
            const answer = await askAI(fullBody);
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