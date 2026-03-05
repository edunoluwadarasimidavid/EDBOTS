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

// Group metadata cache
const groupMetadataCache = new Map();
const CACHE_TTL = 60000; // 1 minute

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

// Cached group metadata getter
const getCachedGroupMetadata = async (sock, groupId) => {
  const now = Date.now();
  const cached = groupMetadataCache.get(groupId);
  if (cached && now - cached.timestamp < CACHE_TTL) return cached.metadata;
  try {
    const metadata = await sock.groupMetadata(groupId);
    groupMetadataCache.set(groupId, { metadata, timestamp: now });
    return metadata;
  } catch (e) {
    console.error('[GroupMetadata Error]', e.message);
    return null;
  }
};

// Live group metadata getter
const getLiveGroupMetadata = async (sock, groupId) => {
  try {
    return await sock.groupMetadata(groupId);
  } catch (e) {
    console.error('[LiveGroupMetadata Error]', e.message);
    return null;
  }
};

const getGroupMetadata = getCachedGroupMetadata;

// Helper: Normalize phone numbers for owner check
const normalizeNumber = (jid) => {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
};

// Permissions
const isOwner = (sender) => {
  if (!sender) return false;
  // Normalize the sender's JID to a number string
  const senderNumber = normalizeNumber(sender.split('@')[0]);
  
  // Get and normalize owner numbers from config
  const owners = (config.owner || []).map(owner => normalizeNumber(owner));

  console.log("Sender:", senderNumber);
  console.log("Owners:", owners);

  return owners.includes(senderNumber);
};

const isMod = (sender) => {
  const number = sender.split('@')[0];
  return database.isModerator(number);
};

// System JID filter
const isSystemJid = (jid) => {
  if (!jid) return true;
  return jid.includes('@broadcast') || jid.includes('status.broadcast') || jid.includes('@newsletter');
};

// Placeholder helpers for admin checks
const isAdmin = async (sock, sender, groupId, metadata) => {
  if (!metadata) return false;
  return metadata.participants.some(p => p.id === sender && p.admin !== null);
};
const isBotAdmin = async (sock, groupId, metadata) => {
  if (!metadata) return false;
  const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  return metadata.participants.some(p => p.id === botJid && p.admin !== null);
};

// --- Auto React ---
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

// --- Auto Sticker ---
const handleAutoSticker = async (sock, msg, content, commands, context) => {
  try {
    if (context.isGroup) {
      const groupSettings = database.getGroupSettings(context.from);
      if (groupSettings.autosticker && (content?.imageMessage || content?.videoMessage)) {
        if (!context.body.startsWith(config.prefix)) {
          const stickerCmd = commands.get('sticker');
          if (stickerCmd) {
            await stickerCmd.execute(sock, msg, [], context);
            return true;
          }
        }
      }
    }
  } catch (e) {
    console.error('[AutoSticker Error]', e);
  }
  return false;
};

// --- Group Protections ---
const handleGroupProtections = async (sock, msg, content, groupMetadata, context) => {
  try {
    if (!context.isGroup || context.isOwner || context.isAdmin) return false;
    const groupSettings = database.getGroupSettings(context.from);
    const { from, sender, isBotAdmin, body } = context;

    // Antilink
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

    // Antitag / Antiall
    if (groupSettings.antitag || groupSettings.antiall) {
      const mentionedJids = content.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const totalMentions = mentionedJids.length;
      const participantsCount = groupMetadata.participants.length;
      if ((groupSettings.antiall && totalMentions > 0) || (groupSettings.antitag && totalMentions > 5 && totalMentions >= participantsCount * 0.5)) {
        await sock.sendMessage(from, { delete: msg.key });
        if (groupSettings.antitagAction === 'kick' && isBotAdmin) {
          await sock.groupParticipantsUpdate(from, [sender], 'remove');
        }
        return true;
      }
    }

    // Antigroupmention
    if (groupSettings.antigroupmention) {
      if (msg.message?.contextInfo?.forwardedNewsletterMessageInfo) {
        await sock.sendMessage(from, { delete: msg.key });
        if (groupSettings.antigroupmentionAction === 'kick' && isBotAdmin) {
          await sock.groupParticipantsUpdate(from, [sender], 'remove');
        }
        return true;
      }
    }

    return false;
  } catch (e) {
    console.error('[GroupProtections Error]', e);
    return false;
  }
};

// --- AI Auto Reply ---
const handleAutoReply = async (sock, msg, context) => {
  try {
    if (config.autoReply && !msg.key.fromMe && context.body && !context.body.startsWith(config.prefix)) {
      const { generateReply } = require('./utils/puterAI');
      if (config.autoTyping) await sock.sendPresenceUpdate('composing', context.from);
      const aiResponse = await generateReply(context.body);
      
      if (aiResponse) {
        await context.reply(aiResponse);
        return true;
      }
    }
  } catch (e) {
    console.error('[AutoReply Error]', e.message);
  }
  return false;
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
    if (await handleAutoReply(sock, msg, commandContext)) return;

    if (isGroup) addMessage(from, sender);

    // Button response
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

  } catch (e) {
    console.error('[MessageHandler Error]', e);
    if (e.message && !e.message.includes('rate-overlimit')) {
      try {
        await sock.sendMessage(msg.key.remoteJid, { text: `${config.messages.error}\n\n${e.message}` }, { quoted: msg });
      } catch (err) {
        console.error('[ErrorMessage Send]', err);
      }
    }
  }
};

// --- Group Participant Update ---
const handleGroupUpdate = async (sock, update) => {
  try {
    const { id, participants, action } = update;
    if (!id || !id.endsWith('@g.us')) return;

    const groupSettings = database.getGroupSettings(id);
    if (!groupSettings.welcome && !groupSettings.goodbye) return;

    const groupMetadata = await getGroupMetadata(sock, id);
    if (!groupMetadata) return;

    for (const participantJid of participants) {
      const participantNumber = participantJid.split('@')[0];

      if (action === 'add' && groupSettings.welcome) {
        let welcomeMsg = groupSettings.welcomeMessage || 'Welcome @user to @group!';
        welcomeMsg = welcomeMsg.replace(/@user/g, `@${participantNumber}`).replace(/@group/g, groupMetadata.subject);
        await sock.sendMessage(id, { text: welcomeMsg, mentions: [participantJid] });
      } else if (action === 'remove' && groupSettings.goodbye) {
        let goodbyeMsg = groupSettings.goodbyeMessage || 'Goodbye @user!';
        goodbyeMsg = goodbyeMsg.replace(/@user/g, `@${participantNumber}`);
        await sock.sendMessage(id, { text: goodbyeMsg, mentions: [participantJid] });
      }
    }
  } catch (e) {
    console.error('[GroupUpdate Error]', e);
  }
};

// --- Anti-Call ---
const initializeAntiCall = (sock) => {
  sock.ev.on('call', async (call) => {
    const from = call.from;
    const callType = call.isVideo ? 'video' : 'voice';
    if (config.antiCall) {
      await sock.sendMessage(from, { text: `📵 Anti-call is active. You cannot ${callType} call me.` });
      try { await sock.updateBlockStatus(from, 'block'); } catch {}
    }
  });
};

module.exports = {
  handleMessage,
  handleGroupUpdate,
  initializeAntiCall,
  isOwner,
  isAdmin,
  isBotAdmin,
  isMod,
  getGroupMetadata
};