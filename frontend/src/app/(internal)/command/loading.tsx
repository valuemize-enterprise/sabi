import '@/styles/command-theme.css';

export default function Loading() {
  return (
    <div className="cc-scope">
      <div className="cc-inner">
        <div className="cc-skel" style={{ height: 34, width: 200, marginBottom: 28, borderRadius: 8 }} />
        <div className="cc-skel" style={{ height: 260, borderRadius: 18, marginBottom: 28 }} />
        {[1, 2, 3].map(i => <div key={i} className="cc-skel" style={{ height: 66, marginBottom: 8, borderRadius: 12 }} />)}
      </div>
    </div>
  );
}
