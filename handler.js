/**
 * Message Handler - Processes incoming messages and executes commands
 */

const config = require('./config');
const database = require('./database');
const { loadCommands } = require('./utils/commandLoader');
const { addMessage } = require('./utils/groupstats');
const { jidDecode, jidEncode } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Group metadata cache to prevent rate limiting
const groupMetadataCache = new Map();
const CACHE_TTL = 60000; // 1 minute cache

// Load all commands
const commands = loadCommands();

// Unwrap WhatsApp containers (ephemeral, view once, etc.)
const getMessageContent = (msg) => {
  if (!msg || !msg.message) return null;
  let m = msg.message;
  if (m.ephemeralMessage) m = m.ephemeralMessage.message;
  if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message;
  if (m.viewOnceMessage) m = m.viewOnceMessage.message;
  if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message;
  return m;
};

// Cached group metadata getter with rate limit handling
const getCachedGroupMetadata = async (sock, groupId) => {
  // ... (implementation remains the same)
};

// Live group metadata getter (always fresh, no cache)
const getLiveGroupMetadata = async (sock, groupId) => {
  // ... (implementation remains the same)
};

const getGroupMetadata = getCachedGroupMetadata;

// Helper functions for permissions
const isOwner = (sender) => {
  if (!sender) return false;
  const normalizedSender = normalizeJidWithLid(sender);
  const senderNumber = normalizeJid(normalizedSender);
  return config.ownerNumber.some(owner => {
    const normalizedOwner = normalizeJidWithLid(owner.includes('@') ? owner : `${owner}@s.whatsapp.net`);
    const ownerNumber = normalizeJid(normalizedOwner);
    return ownerNumber === senderNumber;
  });
};

const isMod = (sender) => {
  const number = sender.split('@')[0];
  return database.isModerator(number);
};

// ... (All other JID and participant helpers remain the same)
// normalizeJid, getLidMappingValue, normalizeJidWithLid, buildComparableIds, findParticipant, isAdmin, isBotAdmin, etc.

// System JID filter
const isSystemJid = (jid) => {
  if (!jid) return true;
  return jid.includes('@broadcast') || jid.includes('status.broadcast') || jid.includes('@newsletter');
};

// --- Refactored Helper Functions ---

const handleAutoReact = async (sock, msg, config) => {
  try {
    if (config.autoReact && msg.message && !msg.key.fromMe) {
      const content = getMessageContent(msg);
      const text = content?.conversation || content?.extendedTextMessage?.text || '';
      const emojis = ['❤️', '🔥', '👌', '💀', '😁', '✨', '👍', '🤨', '😎', '😂', '🤝', '💫'];
      const mode = config.autoReactMode || 'bot';

      if (mode === 'bot' && config.prefix.includes(text.trim()[0])) {
        await sock.sendMessage(msg.key.remoteJid, { react: { text: '⏳', key: msg.key } });
      } else if (mode === 'all') {
        const rand = emojis[Math.floor(Math.random() * emojis.length)];
        await sock.sendMessage(msg.key.remoteJid, { react: { text: rand, key: msg.key } });
      }
    }
  } catch (e) {
    console.error('[AutoReact Error]', e.message);
  }
};

const handleAutoSticker = async (sock, msg, content, commands, context) => {
  try {
    if (context.isGroup) {
      const groupSettings = database.getGroupSettings(context.from);
      if (groupSettings.autosticker && (content?.imageMessage || content?.videoMessage)) {
        if (!context.body.startsWith(config.prefix)) {
          const stickerCmd = commands.get('sticker');
          if (stickerCmd) {
            await stickerCmd.execute(sock, msg, [], context);
            return true; // Sticker was created, stop further processing
          }
        }
      }
    }
  } catch (error) {
    console.error('[AutoSticker Error]:', error);
  }
  return false;
};

const handleGroupProtections = async (sock, msg, content, groupMetadata, context) => {
  try {
    if (!context.isGroup || context.isOwner || context.isAdmin) {
      return false; // No protections for DMs, owners, or admins
    }

    const groupSettings = database.getGroupSettings(context.from);
    const { from, sender, isBotAdmin, body } = context;

    // --- Antilink ---
    if (groupSettings.antilink) {
      const linkPattern = /(https?:\/\/)?([a-zA-Z0-9][a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}/i;
      if (linkPattern.test(body)) {
        await sock.sendMessage(from, { delete: msg.key });
        if (groupSettings.antilinkAction === 'kick' && isBotAdmin) {
          await sock.groupParticipantsUpdate(from, [sender], 'remove');
        }
        return true;
      }
    }
    
    // --- Antitag & Antiall ---
    if (groupSettings.antitag || groupSettings.antiall) {
      const mentionedJids = content.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const totalMentions = mentionedJids.length;
      const participantsCount = groupMetadata.participants.length;
      
      // Antiall is a simpler version of antitag
      if (groupSettings.antiall || (groupSettings.antitag && totalMentions > 5 && totalMentions >= participantsCount * 0.5)) {
        await sock.sendMessage(from, { delete: msg.key });
        if (groupSettings.antitagAction === 'kick' && isBotAdmin) {
            await sock.groupParticipantsUpdate(from, [sender], 'remove');
        }
        return true;
      }
    }

    // --- Antigroupmention ---
    if (groupSettings.antigroupmention) {
      if (msg.message?.contextInfo?.forwardedNewsletterMessageInfo || msg.message?.groupStatusMentionMessage) {
        await sock.sendMessage(from, { delete: msg.key });
        if (groupSettings.antigroupmentionAction === 'kick' && isBotAdmin) {
            await sock.groupParticipantsUpdate(from, [sender], 'remove');
        }
        return true;
      }
    }

    return false; // No protection triggered
  } catch (error) {
    console.error('Error in group protection handler:', error);
    return false;
  }
};

// --- Main Message Handler ---

const handleMessage = async (sock, msg) => {
  try {
    if (!msg.message || isSystemJid(msg.key.remoteJid)) return;

    await handleAutoReact(sock, msg, config);

    const content = getMessageContent(msg);
    if (!content) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.fromMe ? (sock.user.id.split(':')[0] + '@s.whatsapp.net') : (msg.key.participant || from);
    const isGroup = from.endsWith('@g.us');
    const groupMetadata = isGroup ? await getGroupMetadata(sock, from) : null;
    
    let body = content.conversation || content.extendedTextMessage?.text || content.imageMessage?.caption || content.videoMessage?.caption || '';
    body = body.trim();

    const commandContext = {
      from, sender, isGroup, groupMetadata, body,
      isOwner: isOwner(sender),
      isAdmin: isGroup ? await isAdmin(sock, sender, from, groupMetadata) : false,
      isBotAdmin: isGroup ? await isBotAdmin(sock, from, groupMetadata) : false,
      isMod: isMod(sender),
      reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
      react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } })
    };

    if (await handleAutoSticker(sock, msg, content, commands, commandContext)) return;
    if (await handleGroupProtections(sock, msg, content, groupMetadata, commandContext)) return;

    if (isGroup) addMessage(from, sender);

    // Button response handler
    const btn = content.buttonsResponseMessage;
    if (btn) {
      const btnCmd = commands.get(btn.selectedButtonId.replace('btn_', ''));
      if (btnCmd) await btnCmd.execute(sock, msg, [], commandContext);
      return;
    }
    
    if (!body.startsWith(config.prefix)) return;

    const args = body.slice(config.prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    const command = commands.get(commandName);

    if (!command) return;

    // Permission checks
    if (command.ownerOnly && !commandContext.isOwner) return commandContext.reply(config.messages.ownerOnly);
    if (command.modOnly && !commandContext.isMod && !commandContext.isOwner) return commandContext.reply('🔒 This command is only for moderators!');
    if (command.groupOnly && !commandContext.isGroup) return commandContext.reply(config.messages.groupOnly);
    if (command.privateOnly && commandContext.isGroup) return commandContext.reply(config.messages.privateOnly);
    if (command.adminOnly && !commandContext.isAdmin && !commandContext.isOwner) return commandContext.reply(config.messages.adminOnly);
    if (command.botAdminNeeded && !commandContext.isBotAdmin) return commandContext.reply(config.messages.botAdminNeeded);
    if (config.selfMode && !commandContext.isOwner) return;

    if (config.autoTyping) await sock.sendPresenceUpdate('composing', from);

    console.log(`Executing command: ${commandName} from ${sender}`);
    await command.execute(sock, msg, args, commandContext);

  } catch (error) {
    console.error('Error in message handler:', error);
    if (error.message && !error.message.includes('rate-overlimit')) {
        try {
            await sock.sendMessage(msg.key.remoteJid, { text: `${config.messages.error}\n\n${error.message}` }, { quoted: msg });
        } catch (e) {
            console.error('Error sending error message:', e);
        }
    }
  }
};

// ... (handleGroupUpdate and initializeAntiCall remain largely the same, but without `delete require.cache`)

// Group participant update handler
const handleGroupUpdate = async (sock, update) => {
  try {
    const { id, participants, action } = update;
    
    // Validate group JID before processing
    if (!id || !id.endsWith('@g.us')) {
      return;
    }
    
    const groupSettings = database.getGroupSettings(id);
    
    if (!groupSettings.welcome && !groupSettings.goodbye) return;
    
    const groupMetadata = await getGroupMetadata(sock, id);
    if (!groupMetadata) return; // Skip if metadata unavailable (forbidden or error)
    
    for (const participantJid of participants) {
      const participantNumber = participantJid.split('@')[0];
      
      if (action === 'add' && groupSettings.welcome) {
        let welcomeMsg = groupSettings.welcomeMessage || 'Welcome @user to @group!';
        welcomeMsg = welcomeMsg.replace('@user', `@${participantNumber}`).replace('@group', groupMetadata.subject);
        await sock.sendMessage(id, { text: welcomeMsg, mentions: [participantJid] });
      } else if (action === 'remove' && groupSettings.goodbye) {
        let goodbyeMsg = groupSettings.goodbyeMessage || 'Goodbye @user!';
        goodbyeMsg = goodbyeMsg.replace('@user', `@${participantNumber}`);
        await sock.sendMessage(id, { text: goodbyeMsg, mentions: [participantJid] });
      }
    }
  } catch (error) {
    console.error('Error handling group update:', error);
  }
};


// Group participant update handler
const handleGroupUpdate = async (sock, update) => {
  try {
    const { id, participants, action } = update;
    
    // Validate group JID before processing
    if (!id || !id.endsWith('@g.us')) {
      return;
    }
    
    const groupSettings = database.getGroupSettings(id);
    
    if (!groupSettings.welcome && !groupSettings.goodbye) return;
    
    const groupMetadata = await getGroupMetadata(sock, id);
    if (!groupMetadata) return; // Skip if metadata unavailable

    for (const participantJid of participants) {
      const participantNumber = participantJid.split('@')[0];
      
      if (action === 'add' && groupSettings.welcome) {
        // A simple welcome message implementation
        let welcomeMsg = groupSettings.welcomeMessage || 'Welcome @user to the group!';
        welcomeMsg = welcomeMsg.replace('@user', `@${participantNumber}`).replace('@group', groupMetadata.subject);
        await sock.sendMessage(id, { text: welcomeMsg, mentions: [participantJid] });
      } else if (action === 'remove' && groupSettings.goodbye) {
        // A simple goodbye message implementation
        let goodbyeMsg = groupSettings.goodbyeMessage || 'Goodbye @user, we will miss you!';
        goodbyeMsg = goodbyeMsg.replace('@user', `@${participantNumber}`);
        await sock.sendMessage(id, { text: goodbyeMsg, mentions: [participantJid] });
      }
    }
  } catch (error) {
    console.error('Error in handleGroupUpdate:', error);
  }
};

// Anti-call feature initializer
const initializeAntiCall = (sock) => {
  // ... (rest of the function is unchanged)
};

module.exports = {
  handleMessage,
  handleGroupUpdate,
  initializeAntiCall,
  isOwner,
  isAdmin,
  isBotAdmin,
  isMod,
  getGroupMetadata,
  findParticipant
};
