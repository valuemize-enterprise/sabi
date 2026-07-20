'use client';
import Link from 'next/link';
import '@/styles/command-theme.css';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="cc-scope">
      <div className="cc-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em', color: 'var(--ember)', marginBottom: 10 }}>SIGNAL LOST</div>
          <p style={{ color: 'var(--dim)', fontSize: 13, marginBottom: 20 }}>{error?.message || 'The Bridge failed to load.'}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="cc-chip" onClick={reset} style={{ border: '1px solid var(--line)' }}>Try again</button>
            <Link href="/dashboard" className="cc-chip active" style={{ textDecoration: 'none' }}>Dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
