import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

export function DeleteGoalModal({ goal, onClose, onConfirm }: {
  goal: any; onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="sabi-card w-full max-w-md p-6 space-y-5">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-white">Delete goal</p>
            <p className="text-xs text-white/40 mt-0.5">This action cannot be undone</p>
          </div>
        </div>

        {/* Goal details */}
        <div className="bg-white/5 border border-white/8 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Goal</p>
            <p className="text-sm font-semibold text-white">{goal.title}</p>
          </div>
          {goal.description && (
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Description</p>
              <p className="text-xs text-white/60 leading-relaxed">{goal.description}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {goal.metric_type && (
              <div>
                <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Metric</p>
                <p className="text-xs text-white/60">{goal.metric_type.replace(/_/g, ' ')}</p>
              </div>
            )}
            {goal.target_value && (
              <div>
                <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Target</p>
                <p className="text-xs text-white/60">{goal.target_value} {goal.unit}</p>
              </div>
            )}
            {goal.deadline && (
              <div>
                <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Deadline</p>
                <p className="text-xs text-white/60">{goal.deadline}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Status</p>
              <p className="text-xs text-white/60 capitalize">{goal.status}</p>
            </div>
          </div>
          {goal.brands?.name && (
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Brand</p>
              <p className="text-xs text-white/60">{goal.brands.name}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <button onClick={onClose} className="text-xs text-white/40 hover:text-white transition-colors px-4 py-2">
            Cancel
          </button>
          <button onClick={confirm} disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-colors disabled:opacity-50">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {deleting ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}
