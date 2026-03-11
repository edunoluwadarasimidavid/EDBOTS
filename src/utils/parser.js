/**
 * WhatsApp Message Parser Utility
 * Designed to extract clean data from Baileys message objects
 */

const { jidNormalizedUser, getContentType } = require('@whiskeysockets/baileys');
const config = require('../../config');

const parseMessage = async (sock, msg) => {
    if (!msg || !msg.message) return null;

    const from = msg.key.remoteJid;
    const type = getContentType(msg.message);
    const content = msg.message[type];

    // Handle nested message contents (ephemeral, viewOnce, etc)
    const getDeepContent = (m) => {
        if (!m) return null;
        if (m.ephemeralMessage) return getDeepContent(m.ephemeralMessage.message);
        if (m.viewOnceMessageV2) return getDeepContent(m.viewOnceMessageV2.message);
        if (m.viewOnceMessageV2Extension) return getDeepContent(m.viewOnceMessageV2Extension.message);
        if (m.viewOnceMessage) return getDeepContent(m.viewOnceMessage.message);
        if (m.documentWithCaptionMessage) return getDeepContent(m.documentWithCaptionMessage.message);
        return m;
    };

    const rawContent = getDeepContent(msg.message);
    const innerType = getContentType(rawContent);

    // Get body (text content)
    let body = "";
    if (type === 'conversation') body = msg.message.conversation;
    else if (type === 'extendedTextMessage') body = msg.message.extendedTextMessage.text;
    else if (type === 'imageMessage') body = msg.message.imageMessage.caption;
    else if (type === 'videoMessage') body = msg.message.videoMessage.caption;
    else if (innerType === 'conversation') body = rawContent.conversation;
    else if (innerType === 'extendedTextMessage') body = rawContent.extendedTextMessage.text;
    else if (innerType === 'imageMessage') body = rawContent.imageMessage.caption;
    else if (innerType === 'videoMessage') body = rawContent.videoMessage.caption;

    const sender = msg.key.fromMe 
        ? jidNormalizedUser(sock.user.id) 
        : (msg.key.participant || msg.key.remoteJid);
    
    const isGroup = from.endsWith('@g.us');
    const isOwner = (config.owner || []).some(o => sender.includes(o.replace(/[^0-9]/g, '')));
    const botNumber = jidNormalizedUser(sock.user.id);

    // Command parsing
    const prefix = config.prefix || '.';
    const isCmd = body.startsWith(prefix);
    const command = isCmd ? body.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase() : null;
    const args = isCmd ? body.trim().split(/\s+/).slice(1) : body.trim().split(/\s+/);
    const text = args.join(' ');

    return {
        msg,
        from,
        sender,
        isGroup,
        isOwner,
        isCmd,
        command,
        args,
        text,
        body,
        type,
        botNumber,
        isBot: msg.key.fromMe,
        quoted: content?.contextInfo?.quotedMessage ? {
            key: {
                remoteJid: from,
                fromMe: content.contextInfo.participant === botNumber,
                id: content.contextInfo.stanzaId,
                participant: content.contextInfo.participant
            },
            message: content.contextInfo.quotedMessage
        } : null
    };
};

module.exports = { parseMessage };
