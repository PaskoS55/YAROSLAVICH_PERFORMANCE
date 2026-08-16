import { prisma } from '../../lib/prisma';
import AnalyticsControls from './analytics-controls';
import { computePercentile, fmtVal } from '../../lib/analytics';
import RadarChart from '../../components/RadarChart';

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
    tests.find((t) => t.id === searchParams.testId) ??
    tests.find((t) => t.code === 'AGI_505') ??
    tests[0];

  if (tests.length === 0) {
    return (
      <div className="space-y-5 p-6">
        <h1 className="text-3xl font-bold">Динамика</h1>
        <p className="text-sm text-gray-500">
          Нет активных тестов. Добавьте новый тест или восстановите архивный в разделе «Тесты».
        </p>
      </div>
    );
  }

  const allNorms = await prisma.norm.findMany({ where: { deletedAt: null } });
  const normByKey = new Map(allNorms.map((n) => [`${n.position}|${n.testCode}`, n]));

  const radarCategories = await prisma.testCategory.findMany({
    where: { active: true, includeInRadar: true },
    orderBy: [{ radarOrder: 'asc' }, { sortOrder: 'asc' }],
  });
  const radarCatIds = new Set(radarCategories.map((c) => c.id));

  const allPlayers = await prisma.player.findMany({
    where: { deletedAt: null, status: { in: ['ACTIVE', 'LIMITED'] } },
    include: {
      testSessions: {
        where: { deletedAt: null },
        include: { testResults: { where: { deletedAt: null }, include: { test: true } } },
      },
    },
  });

  const sessionsAsc = await prisma.testSession.findMany({
    where: { playerId: player.id, deletedAt: null },
    orderBy: { DateTime: 'asc' },
    include: { testResults: { where: { deletedAt: null }, include: { test: true } } },
  });

  const latest = new Map<
    string,
    { value: number; testCode: string; categoryId: string | null; direction: string }
  >();
  for (const s of [...sessionsAsc].reverse()) {
    for (const r of s.testResults) {
      if (!latest.has(r.testId)) {
        latest.set(r.testId, {
          value: r.value,
          testCode: r.test.code,
          categoryId: r.test.categoryId,
          direction: r.test.direction,
        });
      }
    }
  }

  const catAcc = new Map<string, { sum: number; count: number }>();
  for (const { value, testCode, categoryId, direction } of latest.values()) {
    if (!categoryId || !radarCatIds.has(categoryId)) continue;
    const pct = computePercentile(
      value,
      normByKey.get(`${player.position}|${testCode}`) ?? null,
      direction
    );
    if (pct === null) continue;
    const acc = catAcc.get(categoryId) ?? { sum: 0, count: 0 };
    acc.sum += pct;
    acc.count += 1;
    catAcc.set(categoryId, acc);
  }

  const teamAcc = new Map<string, { sum: number; count: number }>();
  for (const tp of allPlayers) {
    const tLatest = new Map<
      string,
      { value: number; testCode: string; categoryId: string | null; direction: string }
    >();
    const sorted = [...tp.testSessions].sort(
      (a, b) => new Date(b.DateTime).getTime() - new Date(a.DateTime).getTime()
    );
    for (const s of sorted) {
      for (const r of s.testResults) {
        if (!tLatest.has(r.testId)) {
          tLatest.set(r.testId, {
            value: r.value,
            testCode: r.test.code,
            categoryId: r.test.categoryId,
            direction: r.test.direction,
          });
        }
      }
    }
    const pCat = new Map<string, { sum: number; count: number }>();
    for (const { value, testCode, categoryId, direction } of tLatest.values()) {
      if (!categoryId || !radarCatIds.has(categoryId)) continue;
      const pct = computePercentile(
        value,
        normByKey.get(`${tp.position}|${testCode}`) ?? null,
        direction
      );
      if (pct === null) continue;
      const acc = pCat.get(categoryId) ?? { sum: 0, count: 0 };
      acc.sum += pct;
      acc.count += 1;
      pCat.set(categoryId, acc);
    }
    for (const [catId, acc] of pCat) {
      const t = teamAcc.get(catId) ?? { sum: 0, count: 0 };
      t.sum += acc.sum / acc.count;
      t.count += 1;
      teamAcc.set(catId, t);
    }
  }

  const values = radarCategories.map((c) => {
    const acc = catAcc.get(c.id);
    return acc ? Math.round(acc.sum / acc.count) : null;
  });
  const teamValues = radarCategories.map((c) => {
    const acc = teamAcc.get(c.id);
    return acc ? Math.round(acc.sum / acc.count) : null;
  });

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
          {radarCategories.length >= 3 ? (
            <RadarChart
              categories={radarCategories.map((c) => ({ id: c.id, name: c.name }))}
              values={values}
              teamValues={teamValues}
              playerLabel={`${player.lastName} ${player.firstName}`}
            />
          ) : (
            <p className="text-sm text-gray-500">
              Профиль спортсмена не настроен. Включите минимум три категории в «Тесты →
              Категории».
            </p>
          )}
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
              направление:{' '}
              {selectedTest.direction === 'HIGHER_IS_BETTER'
                ? 'выше — лучше'
                : selectedTest.direction === 'LOWER_IS_BETTER'
                  ? 'ниже — лучше'
                  : 'контекстное'}
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
                      {new Date(p.date).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
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