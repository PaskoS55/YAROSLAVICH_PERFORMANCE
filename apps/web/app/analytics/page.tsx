import { prisma } from '../../lib/prisma';
import Link from 'next/link';

const categoryLabels: Record<string, string> = {
  STRENGTH: 'Сила',
  POWER: 'Мощность',
  SPEED: 'Скорость',
  AGILITY: 'Ловкость',
  VOLLEYBALL: 'Волейбол',
  MOBILITY_STABILITY: 'Мобильность',
  BODY_COMPOSITION: 'Состав тела',
};

function computePercentile(
  value: number,
  norm: {
    anchor10: number;
    anchor25: number;
    anchor50: number;
    anchor75: number;
    anchor90: number;
  } | null
): number | null {
  if (!norm) return null;
  const pts = [
    { p: 10, v: norm.anchor10 },
    { p: 25, v: norm.anchor25 },
    { p: 50, v: norm.anchor50 },
    { p: 75, v: norm.anchor75 },
    { p: 90, v: norm.anchor90 },
  ];
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

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
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
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-bold">Графики и радар</h1>
        <p className="text-sm text-gray-500">
          Нет игроков. Добавьте игроков на странице «Команда» или импортируйте данные.
        </p>
      </div>
    );
  }

  const tests = await prisma.test.findMany({
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
  });
  const selectedTest = tests.find((t) => t.id === searchParams.testId) ?? tests[0];

  const sessionsAsc = await prisma.testSession.findMany({
    where: { playerId: player.id, deletedAt: null },
    orderBy: { DateTime: 'asc' },
    include: { testResults: true },
  });

  const latest = new Map<string, number>();
  for (const s of [...sessionsAsc].reverse()) {
    for (const r of s.testResults) {
      if (!latest.has(r.testId)) latest.set(r.testId, r.value);
    }
  }

  const norms = await prisma.norm.findMany({
    where: { position: player.position, deletedAt: null },
  });
  const normByCode = new Map(norms.map((n) => [n.testCode, n]));

  const catAcc = new Map<string, { sum: number; count: number }>();
  for (const t of tests) {
    const v = latest.get(t.id);
    if (v === undefined) continue;
    const pct = computePercentile(v, normByCode.get(t.code) ?? null);
    if (pct === null) continue;
    const acc = catAcc.get(t.category) ?? { sum: 0, count: 0 };
    acc.sum += pct;
    acc.count += 1;
    catAcc.set(t.category, acc);
  }

  const radarCats = ['STRENGTH', 'POWER', 'SPEED', 'AGILITY', 'VOLLEYBALL', 'MOBILITY_STABILITY'];
  const radar = radarCats.map((c) => ({
    label: categoryLabels[c],
    pct: catAcc.has(c) ? Math.round(catAcc.get(c)!.sum / catAcc.get(c)!.count) : 0,
  }));

  const points: { date: Date; value: number; sessionId: string }[] = [];
  for (const s of sessionsAsc) {
    const r = s.testResults.find((x) => x.testId === selectedTest.id);
    if (r) points.push({ date: s.DateTime, value: r.value, sessionId: s.sessionId });
  }

  const W = 640;
  const H = 260;
  const P = 46;
  const vals = points.map((p) => p.value);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (!Number.isFinite(min)) {
    min = 0;
    max = 1;
  }
  if (max - min < 1e-9) {
    min -= 1;
    max += 1;
  }
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(points.length - 1, 1);
  const y = (v: number) => H - P - ((v - min) * (H - 2 * P)) / (max - min);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Графики и радар</h1>

      <div className="rounded-lg bg-white p-4 shadow">
        <div className="flex flex-wrap gap-2">
          {players.map((p) => (
            <Link
              key={p.id}
              href={`/analytics?playerId=${p.id}&testId=${selectedTest.id}`}
              className={`rounded-full px-3 py-1 text-sm ${
                p.id === player.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.lastName} {p.firstName[0]}. ({p.playerId})
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-2 text-lg font-bold">
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
            {radar.map((r, i) => {
              const angle = (Math.PI / 180) * (60 * i - 90);
              const lx = 130 + 108 * Math.cos(angle);
              const ly = 120 + 108 * Math.sin(angle);
              return (
                <text key={r.label} x={lx} y={ly} fontSize="9" textAnchor="middle" fill="#6b7280">
                  {r.label} {r.pct}
                </text>
              );
            })}
            <polygon
              points={radarPolygon(radar.map((r) => r.pct), 130, 120, 90)}
              fill="rgba(200, 16, 46, 0.18)"
              stroke="#c8102e"
              strokeWidth="2"
            />
          </svg>
          <p className="mt-2 text-xs text-gray-500">
            Значение = средний процентиль последних результатов игрока в категории (0–100).
          </p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-2 text-lg font-bold">Динамика по тесту</h2>
          <form className="mb-4">
            <input type="hidden" name="playerId" value={player.id} />
            <select
              name="testId"
              defaultValue={selectedTest.id}
              className="w-full rounded border-2 border-gray-300 px-2 py-1"
            >
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="mt-2 rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700">
              Показать
            </button>
          </form>

          {points.length >= 2 ? (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
              <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#9ca3af" strokeWidth="1" />
              <polyline
                points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
                fill="none"
                stroke="#c8102e"
                strokeWidth="2"
              />
              {points.map((p, i) => (
                <g key={p.sessionId}>
                  <circle cx={x(i)} cy={y(p.value)} r="4" fill="#c8102e" />
                  <text x={x(i)} y={y(p.value) - 8} fontSize="11" textAnchor="middle" fill="#111827">
                    {p.value}
                  </text>
                  <text x={x(i)} y={H - P + 16} fontSize="10" textAnchor="middle" fill="#6b7280">
                    {fmtDate(p.date)}
                  </text>
                </g>
              ))}
            </svg>
          ) : (
            <p className="text-sm text-gray-500">Для этого теста нужно минимум 2 результата.</p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            {selectedTest.name}, {selectedTest.unit}. Направление:{' '}
            {selectedTest.direction === 'HIGHER_IS_BETTER'
              ? 'выше — лучше'
              : selectedTest.direction === 'LOWER_IS_BETTER'
                ? 'ниже — лучше'
                : 'контекстное'}
            .
          </p>
        </div>
      </div>
    </div>
  );
}