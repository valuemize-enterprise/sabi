'use strict';

const supabase = require('../config/supabase');
const { notify } = require('./notification.service');
const dispatch          = require('./email-dispatch.service');

// ── List comments for a task ──────────────────────────────────────

const listComments = async (taskId) => {
  const { data, error } = await supabase
    .from('task_comments')
    .select('id, content, mentions, edited_at, created_at, author:users!user_id(id, full_name, email)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  // Collect every mentioned user ID across all comments
  const mentionIds = [...new Set((data || []).flatMap(c => c.mentions || []))];

  const { data: mentionedUsers } = mentionIds.length
    ? await supabase.from('users').select('id, full_name, email').in('id', mentionIds)
    : { data: [] };

  const mentionMap = Object.fromEntries((mentionedUsers || []).map(u => [u.id, u]));

  return (data || []).map(c => ({
    ...c,
    author_name:  c.author?.full_name || null,
    author_email: c.author?.email     || null,
    author:       undefined,
    mentioned_users: (c.mentions || []).map(uid => ({
      id: uid,
      full_name: mentionMap[uid]?.full_name || null,
      email:     mentionMap[uid]?.email     || null,
    })),
  }));
};

// ── Add a comment ─────────────────────────────────────────────────

const addComment = async (taskId, authorId, body, mentions = []) => {
  if (!body?.trim()) {
    throw Object.assign(new Error('Comment body cannot be empty'), { status: 400 });
  }
  if (body.length > 2000) {
    throw Object.assign(new Error('Comment must be 2000 characters or fewer'), { status: 400 });
  }

  // Fetch task — include assigned_to for notification targeting
  const { data: task } = await supabase
    .from('tasks')
    .select('id, title, brand_id, assigned_to')
    .eq('id', taskId)
    .single()

  if (!task) throw Object.assign(new Error('Task not found'), { status: 404 });

  // Insert comment — no mentions column on table yet
  const { data: comment, error } = await supabase
    .from('task_comments')
    .insert({
      task_id:  taskId,
      user_id:  authorId,
      content:  body.trim(),
      mentions: mentions,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  // Fetch author name once — used in both notification paths
  const { data: author } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', authorId)
    .single()

  const authorName = author?.full_name || 'A team member';

  // ── Notify + email task assignee ─────────────────────────────
  if (task.assigned_to && task.assigned_to !== authorId) {
    // In-app notification
    await notify(
      task.assigned_to,
      'info',
      'New comment on your task',
      `${authorName} commented on: ${task.title}`,
      { task_id: taskId, comment_id: comment.id }
    ).catch(() => {});

    // Email notification
    const { data: assignee } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', task.assigned_to)
      .single()

    if (assignee?.email) {
      await dispatch.send('task_comment', {
        to:       assignee,
        entityId: taskId,
        dedupe:   `comment-${comment.id}`,
        data: {
          assignee_name: assignee.full_name,
          author_name:   authorName,
          task_title:    task.title,
          comment_body:  body.trim(),
        },
      }).catch(() => {}); // non-fatal
    }
  }

  // ── Notify @mentioned users ───────────────────────────────────
  if (mentions?.length) {
    await Promise.allSettled(
      mentions
        .filter(uid => uid !== authorId)
        .map(async uid => {
          // In-app
          await notify(
            uid,
            'info',
            'You were mentioned',
            `${authorName} mentioned you on: ${task.title}`,
            { task_id: taskId, comment_id: comment.id }
          );

          // Email
          const { data: mentioned } = await supabase
            .from('users')
            .select('email, full_name')
            .eq('id', uid)
            .single()

          if (mentioned?.email) {
            await dispatch.send('task_mention', {
              to:       mentioned,
              entityId: taskId,
              dedupe:   `mention-${comment.id}-${uid}`,
              data: {
                mentioned_name: mentioned.full_name,
                author_name:    authorName,
                task_title:     task.title,
                comment_body:   body.trim(),
              },
            }).catch(() => {});
          }
        })
    );
  }

  return comment;
};

// ── Edit a comment ────────────────────────────────────────────────

const editComment = async (commentId, authorId, body) => {
  if (!body?.trim()) {
    throw Object.assign(new Error('Comment cannot be empty'), { status: 400 });
  }

  const { data: existing } = await supabase
    .from('task_comments')
    .select('user_id')
    .eq('id', commentId)
    .single()


  if (!existing) throw Object.assign(new Error('Comment not found'), { status: 404 });
  if (existing.user_id !== authorId) {
    throw Object.assign(new Error('You can only edit your own comments'), { status: 403 });
  }

  const { data, error } = await supabase
    .from('task_comments')
    .update({ content: body.trim() })
    .eq('id', commentId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
};


// ── delete a comment ────────────────────────────────────────────────

const deleteComment = async (commentId, callerId, callerRole) => {
  const { data: existing } = await supabase
    .from('task_comments')
    .select('user_id')
    .eq('id', commentId)
    .single()
  if (!existing) throw Object.assign(new Error('Comment not found'), { status: 404 });

  const isAuthor = existing.user_id === callerId;
  const isAdmin  = ['super_admin', 'admin', 'brand_admin', 'hr', 'md'].includes(callerRole);

  if (!isAuthor && !isAdmin) {
    throw Object.assign(new Error('You can only delete your own comments'), { status: 403 });
  }

  const { error } = await supabase
    .from('task_comments')
    .delete()
    .eq('id', commentId);

  if (error) throw new Error(error.message);
  return { deleted: true };
};

// ── Comment count for a task (used in task card badge) ────────────

const getCommentCount = async (taskId) => {
  const { count, error } = await supabase
    .from('task_comments')
    .select('id', { count: 'exact', head: true })
    .eq('task_id', taskId);

  if (error) return 0;
  return count || 0;
};

module.exports = {
  listComments,
  addComment,
  editComment,
  deleteComment,
  getCommentCount,
};
