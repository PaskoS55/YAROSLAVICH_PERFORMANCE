import React from 'react';

export default function RadarChart({
  categories,
  values,
  teamValues,
  playerLabel,
}: {
  categories: { id: string; name: string }[];
  values: number[];
  teamValues: number[];
  playerLabel: string;
}) {
  const n = categories.length;
  const angle = (i: number) => (Math.PI / 180) * ((360 / n) * i - 90);
  const polygon = (vals: number[]) =>
    vals
      .map((v, i) => {
        const rr = (90 * Math.max(0, Math.min(100, v))) / 100;
        return `${(130 + rr * Math.cos(angle(i))).toFixed(1)},${(120 + rr * Math.sin(angle(i))).toFixed(1)}`;
      })
      .join(' ');

  return (
    <>
      <svg viewBox="0 0 260 240" className="w-full">
        {[25, 50, 75, 100].map((lvl) => (
          <polygon
            key={lvl}
            points={polygon(categories.map(() => lvl))}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}
        <polygon
          points={polygon(teamValues)}
          fill="rgba(107, 114, 128, 0.12)"
          stroke="#9ca3af"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        {categories.map((c, i) => {
          const lx = 130 + 108 * Math.cos(angle(i));
          const ly = 120 + 108 * Math.sin(angle(i));
          const val = values[i];
          return (
            <text key={c.id} x={lx} y={ly} fontSize="9" textAnchor="middle" fill="#6b7280">
              {c.name} {val > 0 ? val : '—'}
            </text>
          );
        })}
        <polygon
          points={polygon(values)}
          fill="rgba(200, 16, 46, 0.18)"
          stroke="#c8102e"
          strokeWidth="2"
        />
      </svg>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--red)' }} />
          {playerLabel}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
          Средний по команде (последние тесты)
        </span>
      </div>
    </>
  );
}