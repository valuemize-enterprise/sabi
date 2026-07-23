'use client';

import type { ReactNode } from 'react';

/* ── Field wrapper ───────────────────────────────────── */
export function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
        {label}{required && <span className="text-red-400"> *</span>}
      </label>
      {children}
      {hint && <span className="text-xs text-white/40">{hint}</span>}
    </div>
  );
}

/* ── Locked (HR-managed) display value ──────────────── */
export function Locked({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">{label}</label>
      <div className="sabi-input bg-white/3 text-white/60 flex items-center justify-between">
        {value} 
        <span className="text-[9px] font-bold uppercase tracking-wide text-white/30 border border-white/10 rounded-full px-2 py-0.5">
          🔒 HR managed
        </span>
      </div>
    </div>
  );
}

/* ── Segmented control ───────────────────────────────── */
export function Seg({ options, value, onChange }: {
  options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5">
      {options.map(o => (
        <button 
          key={o} 
          type="button" 
          className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            value === o 
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' 
              : 'text-white/40 hover:text-white'
          }`}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/* ── Reveal (conditional expand) ─────────────────────── */
export function Reveal({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return <div className="mt-4 pt-4 border-t border-white/5 border-dashed">{children}</div>;
}

/* ── Card ────────────────────────────────────────────── */
export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="sabi-card p-5 mb-4">
      {title && (
        <div className="flex items-center gap-2 mb-5 text-xs font-bold uppercase tracking-widest text-white/50">
          <span>{title}</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Confidential card (Tier 3) ──────────────────────── */
export function ConfCard({ notice, children }: { notice?: ReactNode; children: ReactNode }) {
  return (
    <div className="relative sabi-card p-5 mb-4 bg-amber-500/5 border-amber-500/20 overflow-hidden">
      <div className="absolute top-4 right-[-28px] rotate-[35deg] text-[8px] font-bold uppercase tracking-wider text-white bg-red-600 px-10 py-0.5 shadow-lg pointer-events-none">
        MEDICAL · CONFIDENTIAL
      </div>
      {notice && (
        <div className="flex items-start gap-3 bg-[#12122a] border border-amber-500/20 rounded-xl p-3 mb-5 text-sm text-white/70">
          {notice}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Info note ───────────────────────────────────────── */
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 bg-purple-500/10 rounded-xl p-3 mb-4 text-sm text-white/80">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {children}
    </div>
  );
}

/* ── Grid layouts ────────────────────────────────────── */
export function G1({ children }: { children: ReactNode }) { 
  return <div className="grid grid-cols-1 gap-4 mb-4 last:mb-0">{children}</div>; 
}
export function G2({ children }: { children: ReactNode }) { 
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 last:mb-0">{children}</div>; 
}
export function G3({ children }: { children: ReactNode }) { 
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 last:mb-0">{children}</div>; 
}

/* ── Section footer ──────────────────────────────────── */
export function SecFoot({ onBack, onNext, nextLabel, disabled }: {
  onBack?: () => void; onNext?: () => void; nextLabel?: string; disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 mt-7 pt-5 border-t border-white/10">
      {onBack && (
        <button 
          className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors" 
          onClick={onBack}
        >
          ← Back
        </button>
      )}
      <div className="flex-1" />
      {onNext && (
        <button 
          className="sabi-btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold" 
          onClick={onNext} 
          disabled={disabled}
        >
          {nextLabel ?? 'Continue'} →
        </button>
      )}
    </div>
  );
}

/* ── Dynamic table base ──────────────────────────────── */
export function DelBtn({ onDelete }: { onDelete: () => void }) {
  return (
    <div className="flex items-center justify-center p-1">
      <button 
        className="w-7 h-7 flex items-center justify-center rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all text-lg" 
        onClick={onDelete} 
        type="button" 
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}
export function AddRowBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button 
      className="flex items-center gap-2 w-full text-xs font-bold text-purple-400 bg-transparent border-2 border-dashed border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/5 rounded-xl px-4 py-2.5 transition-all mt-3" 
      type="button" 
      onClick={onClick}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {label}
    </button>
  );
}

/* ── Proficiency selector ─────────────────────────────── */
export function ProficiencyPicker({ value, onChange }: {
  value: string; onChange: (v: string) => void;
}) {
  const opts = ['Very Good', 'Good', 'Fair'];
  return (
    <div className="flex gap-1">
      {opts.map(o => (
        <div 
          key={o} 
          className={`flex-1 px-2 py-1.5 text-center text-[10px] font-bold border rounded-lg cursor-pointer transition-all whitespace-nowrap ${
            value === o 
              ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' 
              : 'text-white/40 border-white/10 hover:border-white/20'
          }`}
          onClick={() => onChange(o)}
        >
          {o === 'Very Good' ? 'V. Good' : o}
        </div>
      ))}
    </div>
  );
}

/* ── Checkbox row ─────────────────────────────────────── */
export function CheckRow({ id, label, checked, onChange }: {
  id: string; label: string; checked: boolean; onChange: (c: boolean) => void;
}) {
  return (
    <label 
      className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all mb-3 ${
        checked 
          ? 'border-green-500/50 bg-green-500/5' 
          : 'border-white/10 hover:border-purple-500/30 hover:bg-purple-500/5'
      }`}
      htmlFor={id}
    >
      <input 
        type="checkbox" 
        id={id} 
        checked={checked} 
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-purple-600 flex-shrink-0 mt-0.5"
      />
      <span className="text-sm text-white/80">{label}</span>
    </label>
  );
}
