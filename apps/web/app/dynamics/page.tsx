import { prisma } from '../../lib/prisma';
import Link from 'next/link';

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

function computePercentile(value: number, norm: {
  anchor10: number; anchor25: number; anchor50: number;
  anchor75: number; anchor90: number;
} | null): number | null {
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

export default async function DynamicsPage({
  searchParams,
}: {
  searchParams: { playerId?: string };
}) {
  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    orderBy: { lastName: 'asc' },
  });

  const selectedPlayerId = searchParams.playerId ?? players[0]?.id;
  const player = players.find((p) => p.id === selectedPlayerId);

  let sessions: Awaited<ReturnType<typeof prisma.testSession.findMany>> = [];
  let tests: Awaited<ReturnType<typeof prisma.test.findMany>> = [];
  let rows: {
    test: typeof tests[number];
    prev: { value: number; date: Date; sessionId: string } | null;
    curr: { value: number; date: Date; sessionId: string } | null;
    percentile: number | null;
  }[] = [];

  if (player) {
    sessions = await prisma.testSession.findMany({
      where: { playerId: player.id, deletedAt: null },
      orderBy: { DateTime: 'desc' },
      take: 2,
      include: { testResults: { include: { test: true } } },
    });

    tests = await prisma.test.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
    });

    const norms = await prisma.norm.findMany({
      where: {
        position: player.position,
        deletedAt: null,
      },
    });
    const normByCode = new Map(norms.map((n) => [n.testCode, n]));

    const [prev, curr] =
      sessions.length === 2 ? [sessions[1], sessions[0]] : [null, sessions[0] ?? null];

    const prevByCode = new Map(
      prev?.testResults.map((r) => [r.test.code, r]) ?? []
    );
    const currByCode = new Map(
      curr?.testResults.map((r) => [r.test.code, r]) ?? []
    );

    for (const t of tests) {
      const prevR = prevByCode.get(t.code);
      const currR = currByCode.get(t.code);
      const norm = normByCode.get(t.code) ?? null;
      rows.push({
        test: t,
        prev: prevR
          ? { value: prevR.value, date: prev!.DateTime, sessionId: prev!.sessionId }
          : null,
        curr: currR
          ? { value: currR.value, date: curr!.DateTime, sessionId: curr!.sessionId }
          : null,
        percentile: currR ? computePercentile(currR.value, norm) : null,
      });
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Динамика</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Игрок</label>
        <div className="flex flex-wrap gap-2">
          {players.map((p) => (
            <Link
              key={p.id}
              href={`/dynamics?playerId=${p.id}`}
              className={`px-3 py-1 rounded-full text-sm ${
                p.id === selectedPlayerId
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.lastName} {p.firstName[0]}. ({p.playerId})
            </Link>
          ))}
        </div>
      </div>

      {player && sessions.length < 2 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm text-yellow-900">
          Для расчёта динамики нужно минимум 2 сессии. У игрока{' '}
          <b>{player.lastName}</b> сейчас {sessions.length}.
        </div>
      )}

      {player && sessions.length === 2 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg">
                {player.lastName} {player.firstName} — динамика
              </h2>
              <div className="text-sm text-gray-500 mt-1">
                Предыдущая: <b>{fmtDate(sessions[1].DateTime)}</b> ({sessions[1].sessionId}) →
                Текущая: <b>{fmtDate(sessions[0].DateTime)}</b> ({sessions[0].sessionId})
              </div>
            </div>
          </div>

          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Тест</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  {fmtDate(sessions[1].DateTime)}
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  {fmtDate(sessions[0].DateTime)}
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Δ</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">%ile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((r) => {
                if (!r.prev || !r.curr) return null;
                const delta = r.curr.value - r.prev.value;
                const isBetter =
                  r.test.direction === 'HIGHER_IS_BETTER'
                    ? delta > 0
                    : r.test.direction === 'LOWER_IS_BETTER'
                      ? delta < 0
                      : null;
                const threshold = r.test.changeThreshold ?? (r.prev.value * 0.03);
                const significant = Math.abs(delta) >= threshold;

                let deltaColor = 'text-gray-500';
                let arrow = '';
                if (isBetter === true && significant) {
                  deltaColor = 'text-green-600 font-semibold';
                  arrow = '↑';
                } else if (isBetter === false && significant) {
                  deltaColor = 'text-red-600 font-semibold';
                  arrow = '↓';
                }

                const pctColor =
                  r.percentile === null
                    ? 'text-gray-400'
                    : r.percentile >= 75
                      ? 'text-green-600 font-semibold'
                      : r.percentile >= 50
                        ? 'text-blue-600'
                        : r.percentile >= 25
                          ? 'text-yellow-600'
                          : 'text-red-600';

                return (
                  <tr key={r.test.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="font-medium">{r.test.name}</div>
                      <div className="text-xs text-gray-400">{r.test.code}</div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-gray-500">
                      {r.prev.value.toFixed(2)} <span className="text-xs">{r.test.unit}</span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {r.curr.value.toFixed(2)} <span className="text-xs text-gray-400">{r.test.unit}</span>
                    </td>
                    <td className={`px-4 py-2 text-right font-mono ${deltaColor}`}>
                      {delta >= 0 ? '+' : ''}
                      {delta.toFixed(2)} {arrow}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono ${pctColor}`}>
                      {r.percentile !== null ? `p${r.percentile}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {player && sessions.length === 2 && (
        <div className="text-xs text-gray-500">
          ↑ — значимое улучшение · ↓ — значимое ухудшение · серый — без значимых изменений.
          Порог значимости: 3% или changeThreshold теста.
          %ile — процентиль по нормативу для позиции <b>{player.position}</b>.
        </div>
      )}
    </div>
  );
}
