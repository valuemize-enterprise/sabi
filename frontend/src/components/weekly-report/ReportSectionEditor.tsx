'use client';

import React, { useState, useEffect } from 'react';
import { ReportSection, SECTION_LABELS, SECTION_ICONS, ReportComment, weeklyReportApi } from '@/lib/weekly-report-api';

interface ReportSectionEditorProps {
  entryId: string;
  section: ReportSection;
  ariaDraft?: string;
  editedValue?: string;
  comments?: ReportComment[];
  isSubmitted: boolean;
  isLeadership: boolean;
  onSaved: (section: ReportSection, value: string) => void;
  onCommentAdded: () => void;
  showPipelineNote?: boolean;
}

export function ReportSectionEditor({
  entryId,
  section,
  ariaDraft,
  editedValue,
  comments = [],
  isSubmitted,
  isLeadership,
  onSaved,
  onCommentAdded,
  showPipelineNote,
}: ReportSectionEditorProps) {
  const [text, setText] = useState(editedValue || ariaDraft || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [flagComment, setFlagComment] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // Keep in sync when parent reloads entry (e.g. after ARIA generation)
  useEffect(() => {
    const newVal = editedValue || ariaDraft || '';
    setText(newVal);
  }, [editedValue, ariaDraft]);

  const isDirty = text !== (editedValue || ariaDraft || '');
  const hasChangesFromDraft = editedValue && ariaDraft && editedValue !== ariaDraft;
  const unresolvedComments = comments.filter(c => !c.resolved);
  const flaggedComments = comments.filter(c => c.flagged && !c.resolved);

  const handleSave = async () => {
    setSaving(true);
    try {
      const fieldKey = `edited_${section}` as `edited_${typeof section}`;
      await weeklyReportApi.updateEntry(entryId, { [fieldKey]: text } as Parameters<typeof weeklyReportApi.updateEntry>[1]);
      setSaved(true);
      onSaved(section, text);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('Save failed', e);
    } finally {
      setSaving(false);
    }
  };

  const useAriaDraft = () => {
    if (ariaDraft) {
      setText(ariaDraft);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setCommentSaving(true);
    try {
      await weeklyReportApi.addComment(entryId, section, commentText, flagComment);
      setCommentText('');
      setFlagComment(false);
      setAddingComment(false);
      onCommentAdded();
    } catch (e) {
      console.error('Comment failed', e);
    } finally {
      setCommentSaving(false);
    }
  };

  const handleResolveComment = async (commentId: string) => {
    try {
      await weeklyReportApi.resolveComment(commentId);
      onCommentAdded();
    } catch (e) {
      console.error('Resolve failed', e);
    }
  };

  const hasContent = !!(ariaDraft || editedValue);
  const icon = SECTION_ICONS[section];
  const label = SECTION_LABELS[section];

  return (
    <div
      style={{
        marginBottom: '28px',
        paddingBottom: '28px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{icon}</span>
          <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>
            {label}
          </h3>
          {section === 'pipeline' && (
            <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', padding: '1px 6px', borderRadius: '4px', background: 'rgba(109,40,217,0.12)', color: '#c4b5fd', border: '1px solid rgba(109,40,217,0.2)' }}>
              Phase 1
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Comment count */}
          {unresolvedComments.length > 0 && (
            <button
              onClick={() => setShowComments(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '3px 8px', borderRadius: '6px',
                background: flaggedComments.length ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                border: `1px solid ${flaggedComments.length ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
                color: flaggedComments.length ? '#f87171' : '#fbbf24',
                fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              💬 {unresolvedComments.length}
              {flaggedComments.length > 0 && ' 🚩'}
            </button>
          )}

          {/* Draft diff toggle */}
          {hasChangesFromDraft && (
            <button
              onClick={() => setShowDiff(v => !v)}
              style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#6d28d9', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {showDiff ? 'Hide draft' : 'Show ARIA draft'}
            </button>
          )}

          {/* Use ARIA draft button (when user has cleared/changed the field) */}
          {ariaDraft && !isSubmitted && isDirty && (
            <button
              onClick={useAriaDraft}
              style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ↩ Reset to ARIA draft
            </button>
          )}
        </div>
      </div>

      {/* Pipeline context note */}
      {section === 'pipeline' && showPipelineNote && !hasContent && (
        <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'rgba(109,40,217,0.07)', border: '1px solid rgba(109,40,217,0.15)', borderRadius: '8px', fontSize: '12px', color: '#a78bfa' }}>
          ✦ ARIA will pull your active pipeline deals and any notes you logged this week. Click "Generate with ARIA" above to draft this section.
        </div>
      )}

      {/* ARIA draft (shown when diff is toggled or when not yet edited) */}
      {ariaDraft && (!editedValue || showDiff) && (
        <div
          style={{
            marginBottom: '12px',
            padding: '12px 14px',
            background: 'rgba(109,40,217,0.06)',
            border: '1px solid rgba(109,40,217,0.15)',
            borderRadius: '8px',
            position: 'relative',
          }}
        >
          <p style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#7c3aed', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>✦</span> ARIA Draft
            {!isSubmitted && (
              <button
                onClick={useAriaDraft}
                style={{ marginLeft: 'auto', color: '#6d28d9', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
              >
                ↓ Use this
              </button>
            )}
          </p>
          <p style={{ fontSize: '13px', color: '#a78bfa', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
            {ariaDraft}
          </p>
        </div>
      )}

      {/* Editable content */}
      {!isSubmitted ? (
        <>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`${icon} ${label} — start writing or generate with ARIA above…`}
            style={{
              width: '100%',
              background: isDirty && text !== ariaDraft ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${isDirty ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
              color: '#e2e8f0',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
              lineHeight: 1.7,
              resize: 'vertical',
              minHeight: section === 'achievements' || section === 'todos' ? '120px' : '90px',
              outline: 'none',
              transition: 'border .2s',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'rgba(109,40,217,0.4)'}
            onBlur={e => e.currentTarget.style.borderColor = isDirty ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <span style={{ fontSize: '11px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
              {text ? `${text.length} chars` : 'Empty'}
            </span>
            {isDirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '6px 16px',
                  borderRadius: '7px',
                  background: saved ? '#10b981' : '#6d28d9',
                  border: 'none',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'Space Grotesk, sans-serif',
                  transition: 'background .2s',
                }}
              >
                {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
              </button>
            )}
          </div>
        </>
      ) : (
        /* Read-only (submitted) view */
        <div
          style={{
            padding: '12px 14px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#94a3b8',
            lineHeight: 1.7,
            whiteSpace: 'pre-line',
          }}
        >
          {editedValue || ariaDraft || <em style={{ color: '#475569' }}>Nothing submitted for this section</em>}
        </div>
      )}

      {/* Comments */}
      {showComments && unresolvedComments.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          {unresolvedComments.map(c => (
            <div
              key={c.id}
              style={{
                padding: '10px 14px',
                marginBottom: '8px',
                background: c.flagged ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                border: `1px solid ${c.flagged ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                borderRadius: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: c.flagged ? '#f87171' : '#fbbf24' }}>
                  {c.flagged ? '🚩 ' : '💬 '}
                  {c.author_name} · {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
                <button
                  onClick={() => handleResolveComment(c.id)}
                  style={{ fontSize: '11px', color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Mark resolved
                </button>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>{c.comment}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add comment (leadership only) */}
      {isLeadership && !addingComment && (
        <button
          onClick={() => setAddingComment(true)}
          style={{ marginTop: '8px', fontSize: '11px', color: '#475569', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace' }}
        >
          + Add comment
        </button>
      )}

      {isLeadership && addingComment && (
        <div style={{ marginTop: '10px' }}>
          <textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder="Leave a comment on this section…"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#f1f5f9',
              borderRadius: '8px',
              padding: '9px 12px',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              resize: 'vertical',
              minHeight: '72px',
              outline: 'none',
              marginBottom: '8px',
            }}
          />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '12px', color: '#94a3b8' }}>
              <input
                type="checkbox"
                checked={flagComment}
                onChange={e => setFlagComment(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              🚩 Flag for meeting discussion
            </label>
            <button
              onClick={() => { setAddingComment(false); setCommentText(''); setFlagComment(false); }}
              style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleAddComment}
              disabled={commentSaving || !commentText.trim()}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                background: '#6d28d9',
                border: 'none',
                color: 'white',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Space Grotesk, sans-serif',
              }}
            >
              {commentSaving ? 'Posting…' : 'Post Comment'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
