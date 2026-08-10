import { prisma } from '../../lib/prisma';

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

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { a?: string; b?: string };
}) {
  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    orderBy: { lastName: 'asc' },
  });

  const playerA = players.find((p) => p.id === searchParams.a) ?? players[0];
  const playerB = players.find((p) => p.id === searchParams.b) ?? players[1] ?? players[0];

  const tests = await prisma.test.findMany({
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
  });

  async function latestByTest(playerId: string) {
    const sessions = await prisma.testSession.findMany({
      where: { playerId, deletedAt: null },
      orderBy: { DateTime: 'desc' },
      include: { testResults: true },
    });
    const map = new Map<string, number>();
    for (const s of sessions) {
      for (const r of s.testResults) {
        if (!map.has(r.testId)) map.set(r.testId, r.value);
      }
    }
    return map;
  }

  const resA = await latestByTest(playerA.id);
  const resB = await latestByTest(playerB.id);

  const normsA = await prisma.norm.findMany({
    where: { position: playerA.position, deletedAt: null },
  });
  const normsB = await prisma.norm.findMany({
    where: { position: playerB.position, deletedAt: null },
  });
  const normA = new Map(normsA.map((n) => [n.testCode, n]));
  const normB = new Map(normsB.map((n) => [n.testCode, n]));

  let winsA = 0;
  let winsB = 0;

  const rows = tests.map((t) => {
    const va = resA.get(t.id) ?? null;
    const vb = resB.get(t.id) ?? null;
    let better: 'A' | 'B' | null = null;
    if (va !== null && vb !== null && va !== vb && t.direction !== 'CONTEXTUAL') {
      const aIsHigher = va > vb;
      better =
        t.direction === 'LOWER_IS_BETTER'
          ? aIsHigher
            ? 'B'
            : 'A'
          : aIsHigher
            ? 'A'
            : 'B';
      if (better === 'A') winsA++;
      else winsB++;
    }
    return {
      test: t,
      va,
      vb,
      better,
      pa: va !== null ? computePercentile(va, normA.get(t.code) ?? null) : null,
      pb: vb !== null ? computePercentile(vb, normB.get(t.code) ?? null) : null,
    };
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Сравнение</h1>

      <form className="grid grid-cols-1 gap-4 rounded-lg bg-white p-4 shadow md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Игрок A</label>
          <select
            name="a"
            defaultValue={playerA.id}
            className="w-full rounded border-2 border-gray-300 px-2 py-1"
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.lastName} {p.firstName} ({p.playerId})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Игрок B</label>
          <select
            name="b"
            defaultValue={playerB.id}
            className="w-full rounded border-2 border-gray-300 px-2 py-1"
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.lastName} {p.firstName} ({p.playerId})
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Сравнить
          </button>
        </div>
      </form>

      <div className="flex items-center gap-6 rounded-lg bg-white p-4 text-sm shadow">
        <span className="font-semibold text-green-700">
          {playerA.lastName}: {winsA}
        </span>
        <span className="text-gray-400">тестов лучше</span>
        <span className="font-semibold text-green-700">
          {playerB.lastName}: {winsB}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                Тест
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                {playerA.lastName} {playerA.firstName[0]}.
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                {playerB.lastName} {playerB.firstName[0]}.
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((r) => (
              <tr key={r.test.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <div className="font-medium">{r.test.name}</div>
                  <div className="text-xs text-gray-400">
                    {r.test.code} · {r.test.unit}
                  </div>
                </td>
                <td
                  className={`px-4 py-2 text-right font-mono ${
                    r.better === 'A'
                      ? 'bg-green-50 font-semibold text-green-700'
                      : 'text-gray-700'
                  }`}
                >
                  {r.va !== null ? r.va.toFixed(2) : '—'}
                  {r.pa !== null && (
                    <span className="ml-2 text-xs text-gray-400">p{r.pa}</span>
                  )}
                </td>
                <td
                  className={`px-4 py-2 text-right font-mono ${
                    r.better === 'B'
                      ? 'bg-green-50 font-semibold text-green-700'
                      : 'text-gray-700'
                  }`}
                >
                  {r.vb !== null ? r.vb.toFixed(2) : '—'}
                  {r.pb !== null && (
                    <span className="ml-2 text-xs text-gray-400">p{r.pb}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Зелёным выделен лучший результат по тесту (для спринтов и T-теста лучше меньшее
        значение). p — процентиль по нормативу для позиции игрока.
      </p>
    </div>
  );
}