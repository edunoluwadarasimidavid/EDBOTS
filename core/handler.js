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
const modeManager = require('../utils/modeManager');
const smartAutoReply = require('../utils/smartAutoReply');
const advancedAntiBan = require('../utils/advancedAntiBan');

// Control-layer gates (additive): the REST API can disable commands globally
// and turn the AI engine on/off. Defaults keep original behavior.
const commandToggles = require('../utils/commandToggles');
const runtimeFlags = require('../utils/runtimeFlags');

// Connection-health gate: every WhatsApp operation must consult this before
// touching the socket, so a closing/closed connection fails fast and cleanly
// instead of throwing "Connection Closed" out of random async callbacks.
const botState = require('./botState');

/** Reconnect notice shown to users when a command hits a dead socket. */
const RECONNECTING_MSG = '🔌 *Bot is reconnecting, please try again shortly.*';

// Rate-limited logging: during a reconnect flap many queued messages can
// arrive; logging every drop would spam the console.
let lastStaleDropLogAt = 0;
const STALE_DROP_LOG_INTERVAL_MS = 30000;

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
    const owner = normalizeNumber(config.owner[0] || "");
    const botNumber = normalizeNumber(sock.user?.id?.split(':')[0] || '');
    
    return (owner !== '' && sender === owner) || (botNumber !== '' && sender === botNumber);
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
    const botJid = (sock.user?.id?.split(':')[0] || '') + '@s.whatsapp.net';
    if (!botJid.startsWith('@')) return false; // socket identity unavailable
    return metadata.participants.some(p => p.id === botJid && p.admin !== null);
};

/**
 * Main Message Handler
 */
const handleMessage = async (sock, msg, commands) => {
    try {
        const from = msg.key.remoteJid;
        if (!msg.message || isSystemJid(from)) return;

        // STALE/CLOSED-SOCKET GATE: the caller (connection.js) has already
        // verified the generation; this re-checks liveness at processing
        // time. If the connection dropped between the event firing and this
        // handler running, the message is skipped — never processed through
        // a dead socket, never queued, never thrown out of.
        if (!botState.isSocketOpen(sock)) {
            const now = Date.now();
            if (now - lastStaleDropLogAt >= STALE_DROP_LOG_INTERVAL_MS) {
                lastStaleDropLogAt = now;
                console.log(`[HANDLER] Ignoring message from stale/closed socket (from ${from}). Further identical messages will be dropped silently for a while.`);
            }
            return;
        }

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
        if (!(await antiBan.shouldRespond(sock, from, isCmd, isPrivileged))) return;

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
                try {
                    // Re-check at send time: long commands (AI, downloads,
                    // media) can outlive the connection.
                    if (!botState.isSocketOpen(sock)) {
                        console.warn('[HANDLER] Reply skipped — socket closed before send.');
                        return null;
                    }
                    await antiBan.simulateHumanBehavior(sock, from, text);
                    return await sock.sendMessage(from, { text }, { quoted: msg });
                } catch (err) {
                    // Never let a reply become an unhandled rejection: log it
                    // and, when it is a connection drop, tell the user once.
                    if (botState.isConnectionError(err)) {
                        console.warn('[HANDLER] Reply failed — connection closed (bot is reconnecting).');
                        return null;
                    }
                    console.error('[HANDLER] Reply failed:', err && err.message ? err.message : err);
                    return null;
                }
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

                // 0. GLOBALLY DISABLED COMMAND CHECK (REST API control layer)
                if (commandToggles.isDisabled(commandName)) {
                   console.log(`[SECURITY BLOCK] Sender: ${senderRaw} Command: ${commandName} Reason: globally disabled via API`);
                   return context.reply('⛔ This command is currently disabled.');
                }

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

                // 6. MODE CHECK - Verify command is allowed in current mode
                const currentMode = modeManager.getMode(from);
                const cmdCategory = (command.category || 'general').toLowerCase();
                if (!modeManager.isAllowed(currentMode, cmdCategory) && !context.isOwner) {
                    console.log(`[MODE BLOCK] Sender: ${senderRaw} Command: ${commandName} Category: ${cmdCategory} Mode: ${currentMode}`);
                    return context.reply(`⛔ This command is not available in *${currentMode.toUpperCase()}* mode.`);
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
                    // Graceful degradation: a disconnect mid-command is
                    // expected and MUST NOT surface as an unhandled rejection.
                    if (botState.isConnectionError(cmdError)) {
                        console.warn(`[COMMAND] ${commandName} aborted — connection closed (bot is reconnecting).`);
                        await context.reply(RECONNECTING_MSG);
                        return;
                    }
                    console.error(`[COMMAND FAILED] ${commandName}:`, cmdError);
                    await context.reply('❌ An internal error occurred while executing this command.');
                }
                return;
            } else {
                console.log(`[SYSTEM] Command NOT FOUND: ${commandName}`);
            }
        }

        // AI Logic - uses unified engine (Puter primary, multi-provider fallback)
        if (fullBody.toLowerCase().startsWith('ai:')) {
            // AI engine gate (REST API control layer). Silently ignore when off,
            // matching existing behavior when AI is unavailable.
            if (!runtimeFlags.getAiEnabled()) return;

            const question = fullBody.slice(3).trim();
            const currentMode = modeManager.getMode(from);
            const answer = await askAI(question, currentMode === 'business' ? 'business' : 'personal');
            if (answer && !answer.startsWith('⚠️')) {
                return await context.reply(answer);
            }
        }

        // Auto-reply: Smart AI auto-reply with keyword learning
        if (!isGroup && !isCmd && !fromMe) {
            // Try smart auto-reply first (keyword matching + AI learning)
            const smartReply = await smartAutoReply.processMessage(from, fullBody, {
                businessHours: '9AM - 6PM',
                greetingMessage: 'Hello! How can we help?'
            });

            if (smartReply) {
                return await context.reply(smartReply.response);
            }

            // Fallback to regular auto-reply if enabled
            if (config.autoReply) {
                const currentMode = modeManager.getMode(from);
                const answer = await askAI(fullBody, currentMode === 'business' ? 'business' : 'personal');
                if (answer && !answer.startsWith('⚠️')) {
                    return await context.reply(answer);
                }
            }
        }

    } catch (e) {
        console.error('[HANDLER ERROR]', e);
    }
};

module.exports = {
    handleMessage
};