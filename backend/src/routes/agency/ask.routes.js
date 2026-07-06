'use strict';

const router     = require('express').Router();
const supabase   = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');
const askService = require('../../services/aria/ask-aria.service');

router.post('/message', authenticate, async (req, res, next) => {
  try {
    const { message, session_id } = req.body;
    if (!message?.trim()) return sendError(res, 400, 'Message is required');

    let session, messages;

    if (session_id) {
      const { data: existing } = await supabase.from('aria_sessions').select('*').eq('id', session_id).eq('user_id', req.user.id).single();
      if (!existing) return sendError(res, 404, 'Session not found');
      session  = existing;
      messages = existing.messages || [];
    } else {
      messages = [];
    }

    messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

    const ariaResponse = await askService.chat({ messages, brand: null, client: req.user });

    messages.push({ role: 'aria', content: ariaResponse, timestamp: new Date().toISOString() });

    let updatedSession;
    if (session_id && session) {
      const { data } = await supabase.from('aria_sessions').update({ messages, updated_at: new Date().toISOString() }).eq('id', session_id).select().single();
      updatedSession = data;
    } else {
      const { data } = await supabase.from('aria_sessions').insert({
        user_id:    req.user.id,
        session_type: 'agency_ask',
        messages,
      }).select().single();
      updatedSession = data;
    }

    sendSuccess(res, { response: ariaResponse, session_id: updatedSession.id, messages });
  } catch (err) { next(err); }
});

router.get('/sessions', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('aria_sessions')
      .select('id, created_at, updated_at, messages')
      .eq('user_id', req.user.id)
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

router.get('/sessions/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('aria_sessions').select('*').eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (error || !data) return sendError(res, 404, 'Session not found');
    sendSuccess(res, { session: data });
  } catch (err) { next(err); }
});

module.exports = router;
