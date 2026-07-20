'use client';

import { useEffect, useState } from 'react';

/** The Bridge's hero instrument — sweeps in once on mount. */
export default function FleetGauge({ healthy, total }: { healthy: number; total: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(t);
  }, []);

  const CIRC = 2 * Math.PI * 80; // r=80
  const pct = total ? healthy / total : 0;
  const offset = CIRC - CIRC * pct;

  return (
    <div className="cc-gauge-wrap">
      <svg viewBox="0 0 180 180">
        <defs>
          <linearGradient id="ccGaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3FBE8A" />
            <stop offset="100%" stopColor="#7C5CFA" />
          </linearGradient>
        </defs>
        <circle className="cc-gauge-track" cx="90" cy="90" r="80" />
        <circle
          className="cc-gauge-fill"
          cx="90" cy="90" r="80"
          strokeDasharray={CIRC}
          strokeDashoffset={mounted ? offset : CIRC}
        />
      </svg>
      <div className="cc-gauge-center">
        <div className="cc-gauge-num">{healthy}<span>/{total}</span></div>
        <div className="cc-gauge-lbl">Fleet healthy</div>
      </div>
    </div>
  );
}
