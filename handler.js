/**
 * Message Handler - Processes incoming messages and executes commands
 */

const config = require('./config');
const database = require('./database');
const { loadCommands } = require('./utils/commandLoader');
const { addMessage } = require('./utils/groupstats');
const fs = require('fs');
const path = require('path');

// --- Import new logic modules ---
const { askAI } = require('./utils/aiEngine');
const groupAiCmd = require('./commands/group/edbot-ai');
const ownerAiCmd = require('./commands/ownerAI/ownerAI');
const menuCmd = require('./commands/menu');

// Data paths
const COMMAND_FILE = path.join(__dirname, 'data', 'commandFile.json');

// Group metadata cache
const groupMetadataCache = new Map();
const CACHE_TTL = 60000; // 1 minute

// Load all commands
const commands = loadCommands();

// Unwrap WhatsApp containers
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
    return null;
  }
};

const getGroupMetadata = getCachedGroupMetadata;

// Helper: Normalize phone numbers for owner check
const normalizeNumber = (jid) => {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
};

const isOwner = (sender) => {
  if (!sender) return false;
  const senderNumber = normalizeNumber(sender.split('@')[0]);
  const owners = (config.owner || []).map(owner => normalizeNumber(owner));
  return owners.includes(senderNumber);
};

const isSystemJid = (jid) => {
  if (!jid) return true;
  return jid.includes('@broadcast') || jid.includes('status.broadcast') || jid.includes('@newsletter');
};

const isAdmin = async (sock, sender, groupId, metadata) => {
  if (!metadata) return false;
  return metadata.participants.some(p => p.id === sender && p.admin !== null);
};

const isBotAdmin = async (sock, groupId, metadata) => {
  if (!metadata) return false;
  const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  return metadata.participants.some(p => p.id === botJid && p.admin !== null);
};

// --- Keyword Auto Reply Logic ---
const handleKeywordReplies = async (sock, from, body) => {
    try {
        if (!fs.existsSync(COMMAND_FILE)) return false;
        const keywords = JSON.parse(fs.readFileSync(COMMAND_FILE, 'utf8'));
        const lowerBody = body.toLowerCase();
        
        for (const [key, response] of Object.entries(keywords)) {
            if (lowerBody === key.toLowerCase() || lowerBody.includes(key.toLowerCase())) {
                await sock.sendMessage(from, { text: response });
                return true;
            }
        }
    } catch (e) {
        console.error('[KeywordReply Error]', e);
    }
    return false;
};

// --- Main Message Handler ---
const handleMessage = async (sock, msg) => {
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
    if (!body) return;

    const context = {
      from, sender, isGroup, groupMetadata, body,
      isOwner: isOwner(sender),
      isAdmin: isGroup ? await isAdmin(sock, sender, from, groupMetadata) : false,
      isBotAdmin: isGroup ? await isBotAdmin(sock, from, groupMetadata) : false,
      reply: (text) => sock.sendMessage(from, { text }, { quoted: msg })
    };

    // 1. Group Logic
    if (isGroup) {
      addMessage(from, sender);
      
      // Group AI Command: .edbot-ai
      if (body.startsWith('.edbot-ai')) {
        const question = body.slice('.edbot-ai'.length).trim();
        return await groupAiCmd.execute(sock, msg, question);
      }
      
      // Normal group messages are ignored by AI
    } 
    
    // 2. Private Chat Logic
    else {
      // Greeting Detection
      const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon'];
      if (greetings.includes(body.toLowerCase())) {
        return await ownerAiCmd.handleGreeting(sock, msg);
      }

      // Keyword Auto Replies
      if (await handleKeywordReplies(sock, from, body)) return;

      // Private AI shortcut: "ai: question"
      if (body.toLowerCase().startsWith('ai:')) {
          const question = body.slice(3).trim();
          await sock.sendMessage(from, { text: "⏳ Thinking..." });
          const answer = await askAI(question);
          return await sock.sendMessage(from, { text: answer });
      }
    }

    // 3. Standard Prefix Commands (.menu, etc.)
    if (body.startsWith(config.prefix)) {
      const args = body.slice(config.prefix.length).trim().split(/\s+/);
      const commandName = args.shift().toLowerCase();

      // Special Menu Command
      if (commandName === 'menu') {
        return await menuCmd.execute(sock, msg);
      }

      const command = commands.get(commandName);
      if (command) {
        // Permission checks
        if (command.ownerOnly && !context.isOwner) return context.reply(config.messages.ownerOnly);
        if (command.groupOnly && !context.isGroup) return context.reply(config.messages.groupOnly);
        if (command.adminOnly && !context.isAdmin && !context.isOwner) return context.reply(config.messages.adminOnly);

        await command.execute(sock, msg, args, context);
      }
    }

  } catch (e) {
    console.error('[MessageHandler Error]', e);
  }
};

// --- Group Participant Update ---
const handleGroupUpdate = async (sock, update) => {
  try {
    const { id, participants, action } = update;
    if (!id || !id.endsWith('@g.us')) return;
    const groupSettings = database.getGroupSettings(id);
    const groupMetadata = await getGroupMetadata(sock, id);
    if (!groupMetadata) return;

    for (const participantJid of participants) {
      const participantNumber = participantJid.split('@')[0];
      if (action === 'add' && groupSettings.welcome) {
        let welcomeMsg = groupSettings.welcomeMessage || 'Welcome @user to @group!';
        welcomeMsg = welcomeMsg.replace(/@user/g, `@${participantNumber}`).replace(/@group/g, groupMetadata.subject);
        await sock.sendMessage(id, { text: welcomeMsg, mentions: [participantJid] });
      }
    }
  } catch (e) {
    console.error('[GroupUpdate Error]', e);
  }
};

const initializeAntiCall = (sock) => {
  sock.ev.on('call', async (call) => {
    if (config.antiCall) {
      await sock.sendMessage(call.from, { text: `📵 Anti-call is active.` });
      try { await sock.updateBlockStatus(call.from, 'block'); } catch {}
    }
  });
};

module.exports = {
  handleMessage,
  handleGroupUpdate,
  initializeAntiCall
};
