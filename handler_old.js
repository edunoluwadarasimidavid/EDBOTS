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
  
  // Handle various wrapper types
  if (m.ephemeralMessage) m = m.ephemeralMessage.message;
  if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message;
  if (m.viewOnceMessageV2Extension) m = m.viewOnceMessageV2Extension.message;
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
    // body is allowed to be empty if there's a quoted message (e.g. for .viewonce)
    const isReply = !!(content.extendedTextMessage?.contextInfo?.quotedMessage);
    if (!body && !isReply) return;

    const context = {
      from, sender, isGroup, groupMetadata, body,
      isOwner: isOwner(sender),
      isAdmin: isGroup ? await isAdmin(sock, sender, from, groupMetadata) : false,
      isBotAdmin: isGroup ? await isBotAdmin(sock, from, groupMetadata) : false,
      reply: (text) => sock.sendMessage(from, { text }, { quoted: msg })
    };

    // --- EXECUTION SCOPE ---
    // Start of a protected execution block
    try {
        // 1. Group Logic
        if (isGroup) {
          addMessage(from, sender);
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

          // AI Auto Reply if enabled
          if (config.autoReply && !msg.key.fromMe && !body.startsWith(config.prefix)) {
              const answer = await askAI(body);
              if (answer && answer !== "NOT_CONNECTED") {
                  return await sock.sendMessage(from, { text: answer }, { quoted: msg });
              }
          }
        }

        // 3. Standard Prefix Commands (.menu, .edbot-ai, etc.)
        if (body.startsWith(config.prefix)) {
          const args = body.slice(config.prefix.length).trim().split(/\s+/);
          const commandName = args.shift().toLowerCase();

          // AI Command: .edbot-ai
          if (commandName === 'edbot-ai' || commandName === 'ai') {
            const question = args.join(' ');
            return await groupAiCmd.execute(sock, msg, question);
          }

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

            // Execute command with individual try-catch to keep bot alive
            try {
                await command.execute(sock, msg, args, context);
            } catch (cmdError) {
                console.error(` [COMMAND ERROR] .${commandName}:`, cmdError);
                context.reply('❌ An internal error occurred while executing this command.');
            }
          }
        }
    } catch (innerError) {
        console.error(' [INTERNAL ERROR] Message processing logic failed:', innerError);
    }

  } catch (e) {
    console.error(' [CRASH PREVENTION] Fatal handleMessage error:', e);
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
