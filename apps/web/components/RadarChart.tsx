import React from 'react';

export function wrapRadarLabel(label: string): string[] {
  const chunks = label.trim().split(/\s+/).flatMap(word => word.match(/.{1,18}/g) ?? []);
  const lines: string[] = [];
  for (const chunk of chunks) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + chunk.length + 1 <= 18) lines[last] += ` ${chunk}`;
    else lines.push(chunk);
  }
  return lines;
}

export default function RadarChart({ categories, values, teamValues, playerLabel }: {
  categories: { id: string; name: string; description?: string; missingLabel?: string }[];
  values: (number | null)[];
  teamValues: (number | null)[];
  playerLabel: string;
}) {
  const n = categories.length;
  const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
  const labels = categories.map((c, i) => wrapRadarLabel(`${c.name} ${finite(values[i]) ? values[i] : c.missingLabel || 'Нет результата'}`));
  const padding = Math.max(35, ...labels.map(lines => lines.length * 6 + 12));
  const cy = 125 + padding;
  const angle = (i: number) => (Math.PI / 180) * ((360 / n) * i - 90);
  const point = (value: number, i: number) => {
    const radius = 90 * Math.max(0, Math.min(100, value)) / 100;
    return { x: 220 + radius * Math.cos(angle(i)), y: cy + radius * Math.sin(angle(i)) };
  };
  const points = (vals: number[]) => vals.map((v, i) => { const p = point(v, i); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ');
  const series = (vals: (number | null)[], name: string, color: string) => {
    const vertices = categories.map((_, i) => finite(vals[i]) ? point(vals[i], i) : null);
    return <g data-series={name} stroke={color} fill={color}>
      {n >= 3 && vertices.every(p => p !== null)
        ? <polygon points={points(vals as number[])} fillOpacity="0.12" strokeWidth="1.5" />
        : vertices.map((p, i) => {
          const next = vertices[(i + 1) % n];
          return p && next ? <line key={i} x1={p.x} y1={p.y} x2={next.x} y2={next.y} strokeWidth="1.5" /> : null;
        })}
      {vertices.map((p, i) => p ? <circle key={categories[i].id} data-category-id={categories[i].id} cx={p.x} cy={p.y} r="2.5" /> : null)}
    </g>;
  };
  return <>
    <svg viewBox={`0 0 440 ${250 + padding * 2}`} className="w-full" role="img" aria-label="Профиль игрока по категориям">
      {[25, 50, 75, 100].map(level => <polygon key={level} points={points(categories.map(() => level))} fill="none" stroke="#e5e7eb" />)}
      {series(teamValues, 'team', '#9ca3af')}
      {series(values, 'player', '#c8102e')}
      {categories.map((c, i) => {
        const x = 220 + 125 * Math.cos(angle(i));
        const y = cy + 125 * Math.sin(angle(i)) - (labels[i].length - 1) * 6;
        return <text key={c.id} data-category-id={c.id} data-label={`${c.name} ${finite(values[i]) ? values[i] : c.missingLabel || 'Нет результата'}`}
          x={x} y={y} fontSize="10" textAnchor="middle" fill="#4b5563">
          {c.description && <title>{c.description}</title>}
          {labels[i].map((line, j) => <tspan key={j} x={x} dy={j ? 12 : 0}>{line}</tspan>)}
        </text>;
      })}
    </svg>
    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-600">
      <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--red)' }} />{playerLabel}</span>
      <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-gray-400" />Средний по команде (последние тесты)</span>
    </div>
  </>;
}
