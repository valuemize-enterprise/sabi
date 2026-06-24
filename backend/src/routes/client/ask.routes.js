/**
 * Ask ARIA Client Routes
 * POST /api/client/ask/message
 * GET  /api/client/ask/sessions
 * GET  /api/client/ask/sessions/:id
 */

'use strict';

const router     = require('express').Router();
const supabase   = require('../../config/supabase');
const { authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');
const askService = require('../../services/aria/ask-aria.service');

// POST /api/client/ask/message
router.post('/message', authenticateClient, async (req, res, next) => {
  try {
    const { message, session_id } = req.body;
    if (!message?.trim()) return sendError(res, 400, 'Message is required');

    const { data: brand } = await supabase.from('brands').select('*').eq('id', req.client.brand_id).single();

    let session, messages;

    if (session_id) {
      const { data: existing } = await supabase.from('aria_sessions').select('*').eq('id', session_id).eq('client_id', req.client.id).single();
      if (!existing) return sendError(res, 404, 'Session not found');
      session  = existing;
      messages = existing.messages || [];
    } else {
      messages = [];
    }

    messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

    const ariaResponse = await askService.chat({ messages, brand, client: req.client });

    messages.push({ role: 'aria', content: ariaResponse, timestamp: new Date().toISOString() });

    let updatedSession;
    if (session_id && session) {
      const { data } = await supabase.from('aria_sessions').update({ messages, updated_at: new Date().toISOString() }).eq('id', session_id).select().single();
      updatedSession = data;
    } else {
      const { data } = await supabase.from('aria_sessions').insert({
        brand_id:   req.client.brand_id,
        client_id:  req.client.id,
        session_type: 'client_ask',
        messages,
      }).select().single();
      updatedSession = data;
    }

    sendSuccess(res, { response: ariaResponse, session_id: updatedSession.id, messages });
  } catch (err) { next(err); }
});

router.get('/sessions', authenticateClient, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('aria_sessions')
      .select('id, created_at, updated_at, messages')
      .eq('client_id', req.client.id)
      .order('updated_at', { ascending: false })
      .limit(10);
    if (error) throw error;

    const sessions = (data || []).map(s => ({
      ...s,
      messageCount:   s.messages?.length || 0,
      lastMessage:    s.messages?.slice(-1)[0]?.content?.slice(0, 100) || '',
      messages: undefined,
    }));

    sendSuccess(res, { sessions });
  } catch (err) { next(err); }
});

router.get('/sessions/:id', authenticateClient, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('aria_sessions').select('*').eq('id', req.params.id).eq('client_id', req.client.id).single();
    if (error || !data) return sendError(res, 404, 'Session not found');
    sendSuccess(res, { session: data });
  } catch (err) { next(err); }
});

module.exports = router;
