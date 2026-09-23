/**
 * @file api/routes/autoreply.js
 * @description Auto-reply settings:
 *   GET/PATCH /api/autoreply                     — global auto-reply flag
 *   GET/PATCH /api/autoreply/chat/:chatId        — per-chat config
 *   POST /api/autoreply/chat/:chatId/keywords    — add keyword rule
 *   DELETE /api/autoreply/chat/:chatId/keywords/:keyword
 *
 * Backed by the existing utils/smartAutoReply.js store
 * (data/smartAutoReply.json) — the same one the WhatsApp handler uses.
 */

const smartAutoReply = require('../../utils/smartAutoReply');
const runtimeFlags = require('../../utils/runtimeFlags');
const { sendJson } = require('../core/http');
const { requireScope } = require('../core/router');
const { validateBody, sanitizeText } = require('../core/validate');
const { badRequest, notFound } = require('../core/errors');

const BOOL = { type: 'boolean' };

function chatExists(chatId) {
  return Object.prototype.hasOwnProperty.call(smartAutoReply.data || {}, chatId);
}

function safeStatus(chatId) {
  const status = smartAutoReply.getStatus(chatId);
  return {
    enabled: status.enabled,
    fallbackToAI: status.fallbackToAI,
    keywordCount: status.keywordCount,
    learnedCount: status.learnedCount,
    totalReplies: status.totalReplies,
    lastReplyTime: status.lastReplyTime
  };
}

function register(router) {
  // Global auto-reply on/off
  router.get('/autoreply', requireScope('read'), async (req, res) => {
    const chats = Object.keys(smartAutoReply.data || {}).map((chatId) => ({
      chatId,
      ...safeStatus(chatId)
    }));
    sendJson(res, 200, {
      ok: true,
      globalEnabled: runtimeFlags.getAutoReplyEnabled(),
      chats
    });
  });

  router.patch('/autoreply', requireScope('write'), async (req, res) => {
    const body = validateBody(req.body, { enabled: { ...BOOL, required: true } });

    // Instant + persistent via runtimeFlags (mutates legacy config, syncs file)
    runtimeFlags.setAutoReplyEnabled(body.enabled);

    sendJson(res, 200, {
      ok: true,
      globalEnabled: runtimeFlags.getAutoReplyEnabled(),
      message: body.enabled ? 'Auto-reply enabled.' : 'Auto-reply disabled.'
    });
  });

  // Per-chat status
  router.get('/autoreply/chat/:chatId', requireScope('read'), async (req, res) => {
    const { chatId } = req.params;
    if (!chatExists(chatId)) {
      return sendJson(res, 200, {
        ok: true,
        chatId,
        exists: false,
        note: 'No auto-reply config yet. PATCH to initialize.',
        config: null
      });
    }
    sendJson(res, 200, { ok: true, chatId, exists: true, config: safeStatus(chatId) });
  });

  // Per-chat enable/disable + AI fallback
  router.patch('/autoreply/chat/:chatId', requireScope('write'), async (req, res) => {
    const { chatId } = req.params;
    const body = validateBody(
      req.body,
      { enabled: { ...BOOL, required: true }, fallbackToAI: BOOL }
    );

    const cfg = smartAutoReply.getConfig(chatId);
    cfg.enabled = body.enabled;
    if (body.fallbackToAI !== undefined) cfg.fallbackToAI = body.fallbackToAI;
    smartAutoReply.save();

    sendJson(res, 200, { ok: true, chatId, config: safeStatus(chatId) });
  });

  // Add keyword rule
  router.post('/autoreply/chat/:chatId/keywords', requireScope('write'), async (req, res) => {
    const { chatId } = req.params;
    const body = validateBody(
      req.body,
      {
        keyword: { type: 'string', required: true, maxLen: 100 },
        response: { type: 'string', required: true, maxLen: 2000 },
        caseSensitive: BOOL
      }
    );

    const keyword = sanitizeText(body.keyword, 100);
    const response = sanitizeText(body.response, 2000);
    if (!keyword || !response) throw badRequest('keyword and response must contain visible text');

    smartAutoReply.addKeyword(chatId, keyword, response, body.caseSensitive !== false);

    sendJson(res, 201, {
      ok: true,
      chatId,
      keyword,
      response,
      caseSensitive: body.caseSensitive !== false,
      config: safeStatus(chatId)
    });
  });

  // Remove keyword rule
  router.delete('/autoreply/chat/:chatId/keywords/:keyword', requireScope('write'), async (req, res) => {
    const { chatId, keyword } = req.params;
    if (!chatExists(chatId)) throw notFound('No auto-reply config for this chat');

    const removed = smartAutoReply.removeKeyword(chatId, keyword);
    if (!removed) throw notFound(`Keyword '${keyword}' not found for this chat`);

    sendJson(res, 200, { ok: true, chatId, keyword, removed: true, config: safeStatus(chatId) });
  });
}

module.exports = { register };
