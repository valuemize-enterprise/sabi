'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, CheckSquare, Clock, AlertCircle, CheckCircle2, Loader2, MoreHorizontal, ChevronRight } from 'lucide-react';
import { tasks as tasksApi } from '@/lib/api';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage, EmptyState, Badge, PageHeader } from '@/components/ui';
import { useRouter } from 'next/navigation';

const COLS = [
  { id: 'todo',        label: 'To Do',       icon: Clock,         color: 'text-white/40'   },
  { id: 'in_progress', label: 'In Progress',  icon: AlertCircle,   color: 'text-amber-400'  },
  { id: 'done',        label: 'Done',         icon: CheckCircle2,  color: 'text-green-400'  },
];
const PRIORITY_COLOR: Record<string,string> = { low:'gray', medium:'blue', high:'amber', urgent:'red' };

export default function BrandTasksPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const router = useRouter();
  const [items, setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setError(null);
    tasksApi.list({ brand_id: brandId, limit: '100' }).then((r: any) => setItems(r.data ?? [])).catch((e: any) => setError(e.message || 'Failed to load tasks')).finally(() => setLoading(false));
  }, [brandId]);

  const create = async () => {
    if (!newTitle.trim()) return;
    setCreating(true); setError(null);
    try {
      const res: any = await tasksApi.create({ brand_id: brandId, title: newTitle });
      setItems(p => [res.data.task, ...p]);
      setNewTitle(''); setShowNew(false);
    } catch (e: any) { setError(e.message || 'Failed to create task'); } finally { setCreating(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    setError(null);
    try {
      await tasksApi.update(id, { status });
      setItems(p => p.map(t => t.id === id ? { ...t, status } : t));
    } catch (e: any) { setError(e.message || 'Failed to update task'); }
  };

  if (loading) return <LoadingPage label="Loading tasks…" />;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <AgencyTopNav />
       <button onClick={() => router.back()} className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit"><ArrowLeft className="w-3.5 h-3.5"/>Back</button>
      <PageHeader title="Tasks" subtitle="Kanban board for this brand"
        action={
          <button className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" /> Add Task
          </button>
        }
      />

      {showNew && (
        <div className="sabi-card p-4 mb-6 flex items-center gap-3">
          <input className="sabi-input flex-1 text-sm" placeholder="Task title…" value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter') create(); if (e.key==='Escape') setShowNew(false); }} autoFocus />
          <button onClick={create} disabled={creating} className="sabi-btn-primary px-4 py-2 text-sm flex items-center gap-2">
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add
          </button>
          <button onClick={() => setShowNew(false)} className="text-white/30 hover:text-white transition-colors text-sm px-2">Cancel</button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400/50 hover:text-red-300 transition-colors text-lg leading-none">&times;</button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {COLS.map(col => {
          const colItems = items.filter(t => t.status === col.id);
          return (
            <div key={col.id} className="min-h-64">
              <div className="flex items-center gap-2 mb-3 px-1">
                <col.icon className={`w-4 h-4 ${col.color}`} />
                <span className="text-sm font-medium text-white/70">{col.label}</span>
                <span className="ml-auto text-xs bg-white/5 text-white/30 px-2 py-0.5 rounded-full">{colItems.length}</span>
              </div>
              <div className="space-y-3">
                {colItems.map(task => (
                  <div key={task.id} className="sabi-card p-3 hover:border-white/10 transition-all">
                    <p className="text-sm text-white mb-2 leading-snug">{task.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge label={task.priority} color={PRIORITY_COLOR[task.priority]??'gray'} />
                      {task.due_date && <span className="text-xs text-white/30">{new Date(task.due_date).toLocaleDateString()}</span>}
                    </div>
                    {col.id !== 'done' && (
                      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/5">
                        {COLS.filter(c => c.id !== col.id).map(c => (
                          <button key={c.id} onClick={() => updateStatus(task.id, c.id)}
                            className="text-xs text-white/30 flex items-center hover:text-white hover:bg-white/5 px-2 py-1 rounded transition-all">
                            <ChevronRight /> <span>{c.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {colItems.length === 0 && (
                  <div className="border-2 border-dashed border-white/5 rounded-xl p-6 text-center">
                    <p className="text-xs text-white/20">No {col.label.toLowerCase()} tasks</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
