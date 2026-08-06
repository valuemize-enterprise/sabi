'use strict';

// ═══════════════════════════════════════════════════════════════════
// notification.service.js
// Sabi Intelligence Suite
//
// Central notification service. Every email sent to a user should
// also call notify() so it appears in their in-app notification feed.
//
// Usage in any service:
//   const { notify } = require('./notification.service');
//   await notify(userId, 'success', 'Task Completed', 'Your task was verified.', { task_id: '...' });
// ═══════════════════════════════════════════════════════════════════

const supabase = require('../config/supabase');

// ── Types ─────────────────────────────────────────────────────────
// type: 'success' | 'warning' | 'info' | 'error'

// ── Create a notification ─────────────────────────────────────────

/**
 * Create an in-app notification for a user.
 * Call this alongside any email send so the notification
 * appears in the user's feed even if email is not read.
 *
 * @param {string}  userId   - UUID of the recipient
 * @param {string}  type     - 'success' | 'warning' | 'info' | 'error'
 * @param {string}  title    - Short heading
 * @param {string}  body     - Detail text (optional)
 * @param {object}  metadata - Extra context: { brand_id, task_id, report_id, ... }
 */
const notify = async (userId, type, title, body = null, metadata = {}) => {
  if (!userId || !type || !title) return null;

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id:  userId,
      type,
      title,
      body:     body     || null,
      metadata: metadata || {},
      is_read:  false,
    })
    .select('id')
    .single();

  if (error) {
    // Non-fatal — log but don't throw, so the caller (email send) still succeeds
    console.error('[notify] Failed to create notification:', error.message);
    return null;
  }

  return data?.id || null;
};

/**
 * Notify multiple users at once (e.g. all HR when a leave is submitted).
 */
const notifyMany = async (userIds, type, title, body = null, metadata = {}) => {
  if (!userIds?.length) return;

  const rows = userIds.map(user_id => ({
    user_id, type, title,
    body:     body     || null,
    metadata: metadata || {},
    is_read:  false,
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) console.error('[notifyMany]', error.message);
};

// ── Read ──────────────────────────────────────────────────────────

const getForUser = async (userId, { limit = 30, unread_only = false } = {}) => {
  let q = supabase
    .from('notifications')
    .select('id, type, title, body, metadata, is_read, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unread_only) q = q.eq('is_read', false);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
};

const getUnreadCount = async (userId) => {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) return 0;
  return count || 0;
};

// ── Mark read ─────────────────────────────────────────────────────

const markRead = async (notificationId, userId) => {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)  // scope to owner — cannot mark others' notifications
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const markAllRead = async (userId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw new Error(error.message);
};

// ── Delete ────────────────────────────────────────────────────────

const deleteNotification = async (notificationId, userId) => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
};

module.exports = {
  notify,
  notifyMany,
  getForUser,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
};
