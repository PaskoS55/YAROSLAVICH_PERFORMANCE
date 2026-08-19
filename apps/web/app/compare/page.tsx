import { prisma } from '../../lib/prisma';
import CompareControls from './compare-controls';
import { computePercentile, fmtVal } from '../../lib/analytics';

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const query = await searchParams;
  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    orderBy: { lastName: 'asc' },
    include: {
      testSessions: {
        where: { deletedAt: null },
        orderBy: { DateTime: 'desc' },
        include: {
          testResults: { where: { deletedAt: null, qcStatus: 'PASSED' }, include: { test: true } },
        },
      },
    },
  });

  if (players.length < 2) {
    return (
      <div className="space-y-5 p-6">
        <h1 className="text-3xl font-bold">Сравнение</h1>
        <p className="text-sm text-gray-500">Для сравнения нужно минимум два игрока.</p>
      </div>
    );
  }

  const a = players.find((p) => p.id === query.a) ?? players[0];
  const b =
    players.find((p) => p.id === query.b && p.id !== a.id) ??
    players.find((p) => p.id !== a.id)!;

  const same = !!query.a && query.a === query.b;

  const norms = await prisma.norm.findMany({ where: { deletedAt: null } });
  const normByKey = new Map(norms.map((n) => [`${n.position}|${n.testCode}`, n]));

  const latestOf = (pl: (typeof players)[number]) => {
    const m = new Map<
      string,
      { value: number; name: string; unit: string; code: string; direction: string }
    >();
    for (const s of pl.testSessions) {
      for (const r of s.testResults) {
        if (!m.has(r.testId)) {
          m.set(r.testId, {
            value: r.value,
            name: r.test.name,
            unit: r.test.unit,
            code: r.test.code,
            direction: r.test.direction,
          });
        }
      }
    }
    return m;
  };

  const la = latestOf(a);
  const lb = latestOf(b);

  const rows: {
    testId: string;
    name: string;
    unit: string;
    va: number;
    vb: number;
    pa: number | null;
    pb: number | null;
    win: 'a' | 'b' | null;
    direction: string;
  }[] = [];

  for (const [testId, ra] of la) {
    const rb = lb.get(testId);
    if (!rb) continue;
    const pa = computePercentile(
      ra.value,
      normByKey.get(`${a.position}|${ra.code}`) ?? null,
      ra.direction
    );
    const pb = computePercentile(
      rb.value,
      normByKey.get(`${b.position}|${rb.code}`) ?? null,
      rb.direction
    );
    let win: 'a' | 'b' | null = null;
    if (ra.direction === 'HIGHER_IS_BETTER') win = ra.value > rb.value ? 'a' : ra.value < rb.value ? 'b' : null;
    if (ra.direction === 'LOWER_IS_BETTER') win = ra.value < rb.value ? 'a' : ra.value > rb.value ? 'b' : null;
    rows.push({
      testId,
      name: ra.name,
      unit: ra.unit,
      va: ra.value,
      vb: rb.value,
      pa,
      pb,
      win,
      direction: ra.direction,
    });
  }

  const winsA = rows.filter((r) => r.win === 'a').length;
  const winsB = rows.filter((r) => r.win === 'b').length;

  const pctLabel = (p: number | null, direction: string) => {
    if (p !== null) return `p${p}`;
    return direction === 'CONTEXTUAL'
      ? 'процентиль не применяется'
      : 'нормативы не настроены';
  };

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-3xl font-bold">Сравнение</h1>
        <p className="mt-1 text-sm text-gray-500">
          Два игрока по последним результатам общих тестов.
        </p>
      </div>

      <CompareControls
        players={players.map((p) => ({
          id: p.id,
          lastName: p.lastName,
          firstName: p.firstName,
          playerId: p.playerId,
        }))}
        aId={a.id}
        bId={b.id}
      />

      {same && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Выбран один и тот же игрок с обеих сторон — выберите двух разных игроков.
        </div>
      )}

      {!same && (
        <>
          <div className="space-y-1 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
            <div>
              <b className="text-gray-900">
                {a.lastName} {a.firstName}
              </b>{' '}
              — лучший результат в {winsA}{' '}
              {winsA % 10 === 1 && winsA % 100 !== 11 ? 'тесте' : 'тестах'}
            </div>
            <div>
              <b className="text-gray-900">
                {b.lastName} {b.firstName}
              </b>{' '}
              — лучший результат в {winsB}{' '}
              {winsB % 10 === 1 && winsB % 100 !== 11 ? 'тесте' : 'тестах'}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Тест</th>
                  <th className="px-4 py-2 text-right">
                    {a.lastName} {a.firstName}
                  </th>
                  <th className="px-4 py-2 text-right">
                    {b.lastName} {b.firstName}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-500">
                      У игроков нет общих тестов с результатами.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.testId}>
                    <td className="px-4 py-3 text-gray-600">{r.name}</td>
                    <td className={`px-4 py-3 text-right ${r.win === 'a' ? 'bg-green-50' : ''}`}>
                      <div className="font-mono text-gray-900">
                        {fmtVal(r.va)} {r.unit}
                      </div>
                      <div className="text-xs text-gray-400">{pctLabel(r.pa, r.direction)}</div>
                    </td>
                    <td className={`px-4 py-3 text-right ${r.win === 'b' ? 'bg-green-50' : ''}`}>
                      <div className="font-mono text-gray-900">
                        {fmtVal(r.vb)} {r.unit}
                      </div>
                      <div className="text-xs text-gray-400">{pctLabel(r.pb, r.direction)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500">
            Зелёным отмечен лучший абсолютный результат (с учётом направления теста). pXX —
            положение каждого игрока относительно нормативов его собственной позиции. Если
            нормативы по тесту не настроены, сравнение работает по абсолютным значениям. Для
            контекстных тестов лучший результат и процентиль автоматически не определяются.
          </p>
        </>
      )}
    </div>
  );
}
