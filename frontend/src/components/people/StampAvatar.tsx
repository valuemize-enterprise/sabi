'use client';

const PALETTE = ['#6C4CF1', '#C4872A', '#3A9A6E', '#D5484C', '#3A3D8F', '#2D8577'];

export function stampColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % PALETTE.length;
  return PALETTE[h];
}

export default function StampAvatar({ name, size = 42 }: { name: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="pp-stamp" style={{
      width: size, height: size, fontSize: size * 0.36,
      background: name.trim() ? stampColor(name) : '#D8D2C4',
      outlineOffset: -Math.max(3, size * 0.12),
    }}>
      {initial}
    </div>
  );
}
