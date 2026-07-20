import '@/styles/people-theme.css';

export default function Loading() {
  return (
    <div className="pp-scope">
      <div className="pp-inner">
        <div style={{ height: 34, width: 200, background: 'var(--line)', borderRadius: 8, marginBottom: 24 }} />
        <div style={{ height: 140, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, marginBottom: 20 }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 60, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, marginBottom: 9 }} />
        ))}
      </div>
    </div>
  );
}
