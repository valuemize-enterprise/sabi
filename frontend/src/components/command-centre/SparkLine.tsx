'use client';

import React from 'react';

interface SparkLineProps {
  data: number[];
  colour?: string;
  width?: number;
  height?: number;
}

export function SparkLine({ data, colour = '#6d28d9', width = 80, height = 28 }: SparkLineProps) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const padX = 2;
  const padY = 3;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = data.map((v, i) => {
    const x = padX + (i / (data.length - 1)) * innerW;
    const y = padY + innerH - ((v - min) / range) * innerH;
    return `${x},${y}`;
  });

  const polyline = points.join(' ');

  // Area fill path
  const firstX = padX;
  const lastX = padX + innerW;
  const bottomY = padY + innerH;
  const areaPath = `M${firstX},${bottomY} ${points.map(p => `L${p}`).join(' ')} L${lastX},${bottomY} Z`;

  // Last point dot
  const lastPoint = points[points.length - 1].split(',');
  const dotX = Number(lastPoint[0]);
  const dotY = Number(lastPoint[1]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      style={{ display: 'block' }}
    >
      {/* Area fill */}
      <path
        d={areaPath}
        fill={colour}
        fillOpacity={0.08}
      />
      {/* Line */}
      <polyline
        points={polyline}
        stroke={colour}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        opacity={0.8}
      />
      {/* End dot */}
      <circle cx={dotX} cy={dotY} r={2.5} fill={colour} />
    </svg>
  );
}
