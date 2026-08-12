import { prisma } from '../../lib/prisma';
import AnalyticsControls from './analytics-controls';

const categoryLabels: Record<string, string> = {
  STRENGTH: 'Сила',
  POWER: 'Мощность',
  SPEED: 'Скорость',
  AGILITY: 'Ловкость',
  VOLLEYBALL: 'Волейбол',
  MOBILITY_STABILITY: 'Мобильность',
};

function fmtVal(v: number) {
  return (Math.round(v * 100) / 100).toString().replace('.', ',');
}

function computePercentile(
  value: number,
  norm: { anchor10: number; anchor25: number; anchor50: number; anchor75: number; anchor90: number } | null
): number | null {
  if (!norm) return null;
  let pts = [
    { p: 10, v: norm.anchor10 },
    { p: 25, v: norm.anchor25 },
    { p: 50, v: norm.anchor50 },
    { p: 75, v: norm.anchor75 },
    { p: 90, v: norm.anchor90 },
  ];
  // Нормативы LOWER_IS_BETTER хранятся в обратном порядке — разворачиваем
  if (pts[0].v > pts[4].v) pts = pts.slice().reverse();
  if (value <= pts[0].v) return pts[0].p;
  if (value >= pts[4].v) return pts[4].p;
  for (let i = 0; i < 4; i++) {
    if (value >= pts[i].v && value <= pts[i + 1].v) {
      const ratio = (value - pts[i].v) / (pts[i + 1].v - pts[i].v);
      return Math.round(pts[i].p + ratio * (pts[i + 1].p - pts[i].p));
    }
  }
  return 50;
}

function radarPolygon(values: number[], cx: number, cy: number, r: number): string {
  return values
    .map((v, i) => {
      const angle = (Math.PI / 180) * (60 * i - 90);
      const rr = (r * v) / 100;
      return `${(cx + rr * Math.cos(angle)).toFixed(1)},${(cy + rr * Math.sin(angle)).toFixed(1)}`;
    })
    .join(' ');
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { playerId?: string; testId?: string };
}) {
  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    orderBy: { lastName: 'asc' },
  });
  const player = players.find((p) => p.id === searchParams.playerId) ?? players[0];

  if (!player) {
    return (
      <div className="space-y-5 p-6">
        <h1 className="text-3xl font-bold">Динамика</h1>
        <p className="text-sm text-gray-500">
          Нет игроков. Добавьте игроков или импортируйте данные.
        </p>
      </div>
    );
  }

  const tests = await prisma.test.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
  });
  const selectedTest =
    tests.find((t) => t.id === searchParams.testId) ?? tests.find((t) => t.code === 'AGI_505') ?? tests[0];

  const allNorms = await prisma.norm.findMany({ where: { deletedAt: null } });
  const normByKey = new Map(allNorms.map((n) => [`${n.position}|${n.testCode}`, n]));

  const allPlayers = await prisma.player.findMany({
    where: { deletedAt: null, status: { in: ['ACTIVE', 'LIMITED'] } },
    include: {
      testSessions: {
        where: { deletedAt: null },
        include: { testResults: { include: { test: true } } },
      },
    },
  });

  const sessionsAsc = await prisma.testSession.findMany({
    where: { playerId: player.id, deletedAt: null },
    orderBy: { DateTime: 'asc' },
    include: { testResults: { include: { test: true } } },
  });

  const latest = new Map<string, { value: number; code: string; category: string }>();
  for (const s of [...sessionsAsc].reverse()) {
    for (const r of s.testResults) {
      if (!latest.has(r.testId)) {
        latest.set(r.testId, { value: r.value, code: r.test.code, category: r.test.category });
      }
    }
  }

  const catAcc = new Map<string, { sum: number; count: number }>();
  for (const { value, code, category } of latest.values()) {
    if (!categoryLabels[category]) continue;
    const pct = computePercentile(value, normByKey.get(`${player.position}|${code}`) ?? null);
    if (pct === null) continue;
    const acc = catAcc.get(category) ?? { sum: 0, count: 0 };
    acc.sum += pct;
    acc.count += 1;
    catAcc.set(category, acc);
  }

  const teamAcc = new Map<string, { sum: number; count: number }>();
  for (const tp of allPlayers) {
    const tLatest = new Map<string, { value: number; code: string; category: string }>();
    const sorted = [...tp.testSessions].sort(
      (a, b) => new Date(b.DateTime).getTime() - new Date(a.DateTime).getTime()
    );
    for (const s of sorted) {
      for (const r of s.testResults) {
        if (!tLatest.has(r.testId)) {
          tLatest.set(r.testId, { value: r.value, code: r.test.code, category: r.test.category });
        }
      }
    }
    for (const { value, code, category } of tLatest.values()) {
      if (!categoryLabels[category]) continue;
      const pct = computePercentile(value, normByKey.get(`${tp.position}|${code}`) ?? null);
      if (pct === null) continue;
      const acc = teamAcc.get(category) ?? { sum: 0, count: 0 };
      acc.sum += pct;
      acc.count += 1;
      teamAcc.set(category, acc);
    }
  }

  const cats = Object.keys(categoryLabels)
    .filter((c) => catAcc.has(c))
    .map((c) => ({
      key: c,
      label: categoryLabels[c],
      pct: Math.round(catAcc.get(c)!.sum / catAcc.get(c)!.count),
    }));

  const radarOrder = Object.keys(categoryLabels).map((c) =>
    catAcc.has(c) ? Math.round(catAcc.get(c)!.sum / catAcc.get(c)!.count) : 0
  );
  const teamOrder = Object.keys(categoryLabels).map((c) =>
    teamAcc.has(c) ? Math.round(teamAcc.get(c)!.sum / teamAcc.get(c)!.count) : 0
  );

  const points = sessionsAsc
    .map((s) => {
      const r = s.testResults.find((r) => r.testId === selectedTest.id);
      return r ? { date: s.DateTime, value: r.value } : null;
    })
    .filter((p): p is { date: Date; value: number } => p !== null);

  const w = 600;
  const h = 240;
  const pl = 46;
  const pr = 20;
  const pt = 20;
  const pb = 30;
  const vals = points.map((p) => p.value);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  const pad = (rawMax - rawMin) * 0.15 || Math.max(Math.abs(rawMax) * 0.05, 0.5);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const span = max - min || 1;
  const x = (i: number) =>
    points.length === 1 ? (w - pl - pr) / 2 + pl : pl + (i * (w - pl - pr)) / (points.length - 1);
  const y = (v: number) => pt + (1 - (v - min) / span) * (h - pt - pb);

  const first = points[0];
  const lastP = points[points.length - 1];
  const delta = first && lastP ? +(lastP.value - first.value).toFixed(2) : null;

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-3xl font-bold">Динамика</h1>
        <p className="mt-1 text-sm text-gray-500">
          Изменение результатов игрока и профиль по категориям.
        </p>
      </div>

      <AnalyticsControls
        players={players.map((p) => ({
          id: p.id,
          lastName: p.lastName,
          firstName: p.firstName,
          playerId: p.playerId,
        }))}
        tests={tests.map((t) => ({ id: t.id, name: t.name }))}
        playerId={player.id}
        testId={selectedTest.id}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-2 text-xl font-bold">
            Профиль: {player.lastName} {player.firstName}
          </h2>
          <svg viewBox="0 0 260 240" className="w-full">
            {[25, 50, 75, 100].map((lvl) => (
              <polygon
                key={lvl}
                points={radarPolygon([lvl, lvl, lvl, lvl, lvl, lvl], 130, 120, 90)}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="1"
              />
            ))}
            <polygon
              points={radarPolygon(teamOrder, 130, 120, 90)}
              fill="rgba(107, 114, 128, 0.12)"
              stroke="#9ca3af"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            {cats.map((c) => {
              const order = Object.keys(categoryLabels).indexOf(c.key);
              const angle = (Math.PI / 180) * (60 * order - 90);
              const lx = 130 + 108 * Math.cos(angle);
              const ly = 120 + 108 * Math.sin(angle);
              return (
                <text key={c.key} x={lx} y={ly} fontSize="9" textAnchor="middle" fill="#6b7280">
                  {c.label} {c.pct}
                </text>
              );
            })}
            <polygon
              points={radarPolygon(radarOrder, 130, 120, 90)}
              fill="rgba(200, 16, 46, 0.18)"
              stroke="#c8102e"
              strokeWidth="2"
            />
          </svg>
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--red)' }} />
              {player.lastName} {player.firstName}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
              Средний по команде (последние тесты)
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-xl font-bold">{selectedTest.name}</h2>
          <div className="mt-1 text-sm text-gray-600">
            {first && lastP && points.length > 1 ? (
              <>
                <span className="font-mono">{fmtVal(first.value)}</span> →{' '}
                <span className="font-mono font-semibold text-gray-900">{fmtVal(lastP.value)}</span>{' '}
                {selectedTest.unit} ·{' '}
                <span className="font-mono text-gray-600">
                  {delta !== null && delta !== 0 ? (delta > 0 ? '↑ +' : '↓ −') : '→'}
                  {delta !== null ? fmtVal(Math.abs(delta)) : ''}
                </span>
              </>
            ) : (
              <span>
                {lastP ? `${fmtVal(lastP.value)} ${selectedTest.unit}` : 'нет данных'}
              </span>
            )}
            <span className="ml-2 text-xs text-gray-400">
              направление: {selectedTest.direction === 'HIGHER_IS_BETTER' ? 'выше — лучше' : selectedTest.direction === 'LOWER_IS_BETTER' ? 'ниже — лучше' : 'контекстное'}
            </span>
          </div>

          <div className="mt-4">
            {points.length === 0 ? (
              <p className="text-sm text-gray-500">Нет данных по этому тесту.</p>
            ) : (
              <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
                <line x1={pl} x2={w - pr} y1={y(rawMax)} y2={y(rawMax)} stroke="#f0f1f3" />
                <line x1={pl} x2={w - pr} y1={y(rawMin)} y2={y(rawMin)} stroke="#f0f1f3" />
                <text x={4} y={y(rawMax) + 3} fontSize="9" fill="#9ca3af">
                  {fmtVal(rawMax)}
                </text>
                <text x={4} y={y(rawMin) + 3} fontSize="9" fill="#9ca3af">
                  {fmtVal(rawMin)}
                </text>
                <polyline
                  points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
                  fill="none"
                  stroke="#c8102e"
                  strokeWidth="2"
                />
                {points.map((p, i) => (
                  <g key={i}>
                    <circle cx={x(i)} cy={y(p.value)} r="3" fill="#c8102e" />
                    <text x={x(i)} y={y(p.value) - 8} fontSize="10" textAnchor="middle" fill="#374151">
                      {fmtVal(p.value)}
                    </text>
                    <text x={x(i)} y={h - 8} fontSize="9" textAnchor="middle" fill="#9ca3af">
                      {new Date(p.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                    </text>
                  </g>
                ))}
              </svg>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Единица: {selectedTest.unit}. Ось Y масштабируется с запасом, чтобы небольшие
            изменения не выглядели скачками.
          </p>
        </div>
      </div>
    </div>
  );
}