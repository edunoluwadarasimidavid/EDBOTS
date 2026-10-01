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
 * Convert any WhatsApp JID to a bare number: strips the device/agent suffix
 * ("23491...:12@s.whatsapp.net" -> "23491..."), @lid/@s.whatsapp.net hosts
 * and every non-digit. Correct for phone JIDs AND LID JIDs.
 */
const jidToNumber = (jid) => {
    if (!jid) return '';
    const bare = String(jid).split('@')[0].split(':')[0];
    return bare.replace(/[^0-9]/g, '');
};

/**
 * Collect every plausible JID a sender may be identified by.
 * Modern WhatsApp increasingly uses LID JIDs ("...@lid") for regular
 * accounts and linked-device self-messages, while Business accounts keep
 * classic phone JIDs. The same human can appear with EITHER form, so
 * security checks must consider all candidates, never just one.
 */
const senderJidCandidates = (msg) => {
    const jids = new Set();
    const push = (j) => { if (j) jids.add(String(j)); };
    push(msg.key?.participant);
    push(msg.participant);
    // In private chats the sender IS the chat (phone and LID forms appear here)
    if (msg.key?.remoteJid && !String(msg.key.remoteJid).endsWith('@g.us')) {
        push(msg.key.remoteJid);
    }
    return Array.from(jids);
};

/**
 * Checks if sender is owner — matching across ALL JID-form candidates.
 */
const isOwner = (sock, senderNumbers, fromMe = false) => {
    if (fromMe === true) return true;
    const nums = Array.isArray(senderNumbers) ? senderNumbers : [senderNumbers].filter(Boolean);
    if (!nums.length) return false;

    const botNumber = jidToNumber(sock?.user?.id);
    const ownerList = [...(config.owner || []), ...(config.ownerNumber || [])];
    const ownerNumbers = ownerList.map(jidToNumber).filter(Boolean);

    return nums.some((n) => (botNumber && n === botNumber) || ownerNumbers.includes(n));
};

/**
 * Checks if JID is system/broadcast
 */
const isSystemJid = (jid) => {
    if (!jid) return true;
    return jid.includes('@broadcast') || jid.includes('status.broadcast') || jid.includes('@newsletter');
};

/**
 * Checks if sender is admin — compares bare numbers so LID and phone JID
 * forms of the same participant both match the group participant list.
 */
const isAdmin = async (sock, senderNumbers, groupId, metadata) => {
    if (!metadata) return false;
    const nums = new Set(Array.isArray(senderNumbers) ? senderNumbers : [senderNumbers].filter(Boolean));
    if (!nums.size) return false;
    return metadata.participants.some((p) => nums.has(jidToNumber(p.id)) && p.admin !== null);
};

/**
 * Checks if bot is admin — compares bare numbers so LID vs phone JID forms
 * of the bot's own identity both match the participant list.
 */
const isBotAdmin = async (sock, groupId, metadata) => {
    if (!metadata) return false;
    const botNumbers = new Set([
        jidToNumber(sock?.user?.id),
        sock?.user?.lid ? jidToNumber(sock.user.lid) : null
    ].filter(Boolean));
    return metadata.participants.some(p => botNumbers.has(jidToNumber(p.id)) && p.admin !== null);
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
        
        // STEP 2 — Sender resolution across ALL JID forms (phone + LID).
        // Never rely on a single JID: friends on regular WhatsApp and the
        // bot's own linked-device messages may arrive as LID JIDs.
        const senderJids = senderJidCandidates(msg);
        const senderNumbers = senderJids.map(jidToNumber).filter(Boolean);
        const senderRaw = senderJids[0] || from;   // display/log value
        const sender = senderNumbers[0] || jidToNumber(from);
        
        // 0. BANNED CHECK (CRITICAL)
        if (isBanned(senderRaw)) {
            // We only reply once or silent? User asked for reply: ⛔ Access denied.
            // To avoid spamming back to banned users, we check if it was a command
            const body = (content.conversation || content.extendedTextMessage?.text || '').trim();
            if (body.startsWith(config.prefix || '.')) {
                console.log(`[DROP] Banned sender sent command: ${senderRaw}`);
                return; 
            }
            console.log(`[DROP] Banned sender: ${senderRaw}`);
            return;
        }

        // Part C — daily message quota for the active API operator.
        // The v1 auth layer registers the operator identity
        // (api/v1/messageQuota.js); with no operator registered (pure
        // self-hosted, app never connected) the quota is INACTIVE. Denied
        // messages never consume quota; the one-time daily notice is
        // best-effort and does not count as usage.
        try {
            const quota = require('../api/v1/messageQuota');
            const verdict = quota.admitMessage({ fromMe });
            if (!verdict.allowed) {
                console.log(`[QUOTA] Daily message limit reached (${verdict.used}/${verdict.ceiling})` +
                    `${verdict.userId ? ` for operator ${verdict.userId}` : ''} — message dropped`);
                if (verdict.shouldNotify && !isGroup && sock && sock.sendMessage) {
                    try {
                        await sock.sendMessage(from, {
                            text: '⚠️ *Daily message limit reached.* Watch a rewarded ad in the app ' +
                                  'to raise the limit, or upgrade to premium for unlimited messages.'
                        });
                    } catch { /* best-effort notice */ }
                }
                return;
            }
        } catch (quotaErr) {
            // The quota is an availability guard, never a message-path dependency.
            console.error('[QUOTA] check failed (allowing message):', quotaErr && quotaErr.message);
        }

        const ownerStatus = isOwner(sock, senderNumbers, fromMe);
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
        const adminStatus = isGroup ? await isAdmin(sock, senderNumbers, from, groupMetadata) : false;
        const isPrivileged = ownerStatus ? 'owner' : adminStatus;
        if (!(await antiBan.shouldRespond(sock, from, isCmd, isPrivileged))) return;

        // selfMode check
        if (config.selfMode && !ownerStatus && isCmd) {
            console.log(`[DROP] selfMode blocked command from ${senderRaw}: ${commandName || 'unknown'}`);
            return;
        }

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
                    console.error(`[COMMAND FAILED] ${commandName}:`, cmdError);
                    context.reply('❌ An internal error occurred while executing this command.');
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