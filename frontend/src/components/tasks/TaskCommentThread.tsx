'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const getHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('sabi_token') || '' : ''}`,
});

interface Comment {
  id: string;
  content: string;
  mentions: string[];
  edited_at: string | null;
  created_at: string;
  author_name: string | null;
  author_email: string | null;
  mentioned_users: BrandMember[];
}

interface BrandMember {
  id: string;
  full_name: string;
  email: string;
}

interface TaskCommentThreadProps {
  taskId: string;
  currentUser: { id: string; name: string; role: string };
  brandId: string;
}

// ── Helpers ───────────────────────────────────────────────────────

const relTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};


// Strips leading @Name mention tokens from content, leaving just the message
function stripMentions(content: string, mentionedUsers: BrandMember[]) {
  if (mentionedUsers.length === 0) return content;

  // Match both full names and first names (covers however the mention was inserted)
  const names = mentionedUsers
    .flatMap(u => [u.full_name, u.full_name.split(' ')[0]])
    .sort((a, b) => b.length - a.length) // longest first, avoid partial matches
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); // escape regex chars

  const pattern = new RegExp(`@(${names.join('|')})\\s*`, 'g');

  return content.replace(pattern, '').trim();
}

const initials = (name: string | null) =>
  (name || '?').split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase();

// ── Comment row ────────────────────────────────────────────────────

function CommentRow({
  comment, isOwn, onDelete, onEdit,
}: {
  comment: Comment;
  isOwn: boolean;
  onDelete: (id: string) => void;
  onEdit: (id: string, body: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.content);
  const [deleting, setDeleting] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<BrandMember[]>(comment.mentioned_users || []);

  const startEdit = () => { setEditBody(comment.content); setEditing(true); };

  useEffect(() => {
    setMentionedUsers(comment.mentioned_users || []);
  }, [comment.mentioned_users]);

  const mentionElements = mentionedUsers.map((mention, i) => (
    <span key={mention.id}>
      <span style={{ color: '#c4b5fd', fontWeight: 600 }}>
        @{mention.full_name}
      </span>
      {i < mentionedUsers.length - 1 ? ', ' : ''}
    </span>
  ));

  const avatarInitials = mentionedUsers.length > 0
    ? initials(mentionedUsers[0].full_name)
    : initials(comment.author_name);

  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
      {/* Avatar */}
      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(109,40,217,0.2)', border: '1px solid rgba(109,40,217,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px', fontWeight: 700, color: '#c4b5fd', fontFamily: 'Space Grotesk, sans-serif' }}>
        {avatarInitials}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9', fontFamily: 'Space Grotesk, sans-serif' }}>
            {comment.author_name || 'Unknown'}
          </span>
          {mentionedUsers.length > 0 && (
            <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>
              mentioned {mentionElements}
            </span>
          )}
          <span style={{ fontSize: '10px', color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>
            {relTime(comment.created_at)}
            {comment.edited_at ? ' · edited' : ''}
          </span>
        </div>

        {/* Body / edit textarea */}
        {editing ? (
          <div>
            <textarea
              autoFocus
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              style={{ width: '100%', minHeight: '60px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(109,40,217,0.3)', borderRadius: '7px', padding: '8px 10px', fontSize: '13px', color: '#f1f5f9', fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <button
                onClick={() => { onEdit(comment.id, editBody); setEditing(false); }}
                style={{ padding: '4px 12px', borderRadius: '5px', background: '#6d28d9', border: 'none', color: 'white', fontSize: '12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                style={{ padding: '4px 10px', borderRadius: '5px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', fontSize: '12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
            {stripMentions(comment.content, mentionedUsers) || null}
          </p>
        )}

        {/* Actions — own comments only */}
        {isOwn && !editing && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              onClick={startEdit}
              style={{ fontSize: '11px', color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Inter, sans-serif' }}
            >
              Edit
            </button>
            <button
              onClick={async () => {
                if (!window.confirm('Delete this comment?')) return;
                setDeleting(true);
                try {
                  await onDelete(comment.id);
                } finally {
                  setDeleting(false);
                }
              }}
              disabled={deleting}
              style={{ fontSize: '11px', color: '#475569', background: 'none', border: 'none', cursor: deleting ? 'not-allowed' : 'pointer', padding: 0, fontFamily: 'Inter, sans-serif', opacity: deleting ? 0.5 : 1 }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main thread ────────────────────────────────────────────────────

export function TaskCommentThread({ taskId, currentUser, brandId }: TaskCommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [members, setMembers] = useState<BrandMember[]>([]);
  const [mentionQ, setMentionQ] = useState<string | null>(null);
  const [mentions, setMentions] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/tasks/${taskId}/comments`, { headers: getHeaders() });
      const json = await res.json();
      setComments(json.comments || []);
    } catch { } finally { setLoading(false); }
  }, [taskId]);

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/brands/${brandId}/members`, { headers: getHeaders() });
      const json = await res.json();
      setMembers(json.members || json.users || []);
    } catch { }
  }, [brandId]);

  useEffect(() => {
    loadComments();
    loadMembers();
    const interval = setInterval(loadComments, 15000);
    return () => clearInterval(interval);
  }, [loadComments, loadMembers]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  const handleBodyChange = (val: string) => {
    setBody(val);
    const cursor = textareaRef.current?.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w*)$/);
    setMentionQ(atMatch ? atMatch[1] : null);
  };

  const selectMention = (member: BrandMember) => {
    const cursor = textareaRef.current?.selectionStart ?? body.length;
    const before = body.slice(0, cursor);
    const after = body.slice(cursor);
    const replaced = before.replace(/@\w*$/, `@${member.full_name.split(' ')[0]} `);
    setBody(replaced + after);
    setMentions(prev => [...new Set([...prev, member.id])]);
    setMentionQ(null);
    textareaRef.current?.focus();
  };

  const submit = async () => {
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ body: body.trim(), mentions }),
      });
      if (!res.ok) throw new Error('Failed to post comment');
      setBody('');
      setMentions([]);
      await loadComments();
    } catch { } finally { setSubmitting(false); }
  };

  const editComment = async (commentId: string, newBody: string) => {
    await fetch(`${API}/api/tasks/${taskId}/comments/${commentId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ body: newBody }),
    });
    await loadComments();
  };

  const deleteComment = async (commentId: string) => {
    await fetch(`${API}/api/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    await loadComments();
  };

  const filteredMembers = mentionQ !== null
    ? members.filter(m =>
      m.full_name.toLowerCase().includes(mentionQ.toLowerCase()) &&
      m.id !== currentUser.id
    ).slice(0, 5)
    : [];

  return (
    <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '14px' }}>
        Comments {comments.length > 0 ? `(${comments.length})` : ''}
      </p>

      <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '14px' }}>
        {loading ? (
          <p style={{ fontSize: '12px', color: '#475569' }}>Loading…</p>
        ) : comments.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#374151', textAlign: 'center', padding: '20px 0' }}>
            No comments yet. Be the first to add one.
          </p>
        ) : (
          comments.map(c => (
            <CommentRow
              key={c.id}
              comment={c}
              isOwn={c.author_email === currentUser.name || true /* swap with ID check */}
              onEdit={editComment}
              onDelete={deleteComment}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ position: 'relative' }}>
        {filteredMembers.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, marginBottom: '4px',
            background: '#0c0c1e', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', overflow: 'hidden', minWidth: '200px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 20,
          }}>
            {filteredMembers.map(m => (
              <button
                key={m.id}
                onClick={() => selectMention(m)}
                style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#f1f5f9', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(109,40,217,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(109,40,217,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#c4b5fd', fontWeight: 700 }}>
                  {initials(m.full_name)}
                </span>
                {m.full_name}
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={body}
          onChange={e => handleBodyChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder="Add a comment… Use @ to mention someone. ⌘+Enter to submit."
          rows={3}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
            padding: '10px 12px', fontSize: '13px', color: '#f1f5f9',
            fontFamily: 'Inter, sans-serif', resize: 'none', outline: 'none',
            boxSizing: 'border-box', lineHeight: 1.6,
          }}
          onFocus={e => { e.target.style.borderColor = 'rgba(109,40,217,0.4)'; }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <span style={{ fontSize: '10px', color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>
            {body.length}/2000
          </span>
          <button
            onClick={submit}
            disabled={!body.trim() || submitting || body.length > 2000}
            style={{
              padding: '7px 16px', borderRadius: '7px',
              background: body.trim() && !submitting ? '#6d28d9' : 'rgba(109,40,217,0.25)',
              border: 'none', color: 'white', fontSize: '13px', fontWeight: 700,
              cursor: body.trim() && !submitting ? 'pointer' : 'not-allowed',
              fontFamily: 'Space Grotesk, sans-serif',
            }}
          >
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}