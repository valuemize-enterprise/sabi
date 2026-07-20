'use client';
import Link from 'next/link';
import '@/styles/people-theme.css';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="pp-scope">
      <div className="pp-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em', color: 'var(--ember)', marginBottom: 10 }}>PAGE MISPLACED</div>
          <p style={{ color: 'var(--soft)', fontSize: 13, marginBottom: 20 }}>{error?.message || 'People OS failed to load.'}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="pp-btn pp-btn-ghost" onClick={reset}>Try again</button>
            <Link href="/dashboard" className="pp-btn pp-btn-primary" style={{ textDecoration: 'none' }}>Dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
