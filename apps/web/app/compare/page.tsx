import { prisma } from '../../lib/prisma';
import CompareControls from './compare-controls';
import { latestMeasurements } from '../../lib/measurements';
import { profileCategoryCoverage } from '../../lib/profile-coverage';
import { hasProfileConfirmation } from '../../lib/profile-confirmation';
import { fmtVal } from '../../lib/analytics';
import { requireAppContext } from '../../lib/app-context';
import { loadTeamReferenceProfile } from '../../lib/references';

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const query = await searchParams;
  const context = await requireAppContext();
  const now = new Date();
  const players = await prisma.player.findMany({
    where: { teamId: context.teamId, deletedAt: null },
    orderBy: { lastName: 'asc' },
    include: {
      testSessions: {
        where: { teamId: context.teamId, seasonId: context.seasonId, deletedAt: null, DateTime: { lte: now } },
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

  const referenceProfile = await loadTeamReferenceProfile(context.teamId);
  const confirmed = !!referenceProfile?.explicitlySelected && await hasProfileConfirmation(context.teamId, referenceProfile);
  const tests = await prisma.test.findMany({ where: { deletedAt: null }, orderBy: { code: 'asc' } });
  const la = latestMeasurements(a.testSessions, now);
  const lb = latestMeasurements(b.testSessions, now);
  const entries = referenceProfile?.entries ?? [];
  const ca = profileCategoryCoverage(tests, entries, referenceProfile, a, confirmed, la, now);
  const cb = profileCategoryCoverage(tests, entries, referenceProfile, b, confirmed, lb, now);
  const label = (metric: (typeof ca.metrics)[number]) => metric.score
    ? `${metric.score.description}: ${fmtVal(metric.score.raw)}` : metric.reason;
  const rows = tests.map((test, index) => {
    const va = la.get(test.id)?.value ?? null;
    const vb = lb.get(test.id)?.value ?? null;
    let win: 'a' | 'b' | null = null;
    if (va !== null && vb !== null) {
      if (test.direction === 'HIGHER_IS_BETTER') win = va > vb ? 'a' : va < vb ? 'b' : null;
      if (test.direction === 'LOWER_IS_BETTER') win = va < vb ? 'a' : va > vb ? 'b' : null;
    }
    return { testId: test.id, name: test.name, unit: test.unit, va, vb, win,
      labelA: label(ca.metrics[index]), labelB: label(cb.metrics[index]) };
  }).filter(row => row.va !== null || row.vb !== null);

  const winsA = rows.filter((r) => r.win === 'a').length;
  const winsB = rows.filter((r) => r.win === 'b').length;

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-3xl font-bold">Сравнение</h1>
        <p className="mt-1 text-sm text-gray-500">
          Два игрока по последним подтверждённым историческим результатам.
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
                      У игроков нет подтверждённых исторических результатов.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.testId}>
                    <td className="px-4 py-3 text-gray-600">{r.name}</td>
                    <td className={`px-4 py-3 text-right ${r.win === 'a' ? 'bg-green-50' : ''}`}>
                      <div className="font-mono text-gray-900">
                        {r.va === null ? 'Нет результата' : `${fmtVal(r.va)} ${r.unit}`}
                      </div>
                      <div className="text-xs text-gray-400">{r.labelA}</div>
                    </td>
                    <td className={`px-4 py-3 text-right ${r.win === 'b' ? 'bg-green-50' : ''}`}>
                      <div className="font-mono text-gray-900">
                        {r.vb === null ? 'Нет результата' : `${fmtVal(r.vb)} ${r.unit}`}
                      </div>
                      <div className="text-xs text-gray-400">{r.labelB}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500">
            Зелёным отмечен лучший абсолютный результат с учётом направления теста, а не персональный рекорд. Стандартизированный балл и эмпирический перцентиль — разные оценки; источник и совместимость проверяются так же, как в профиле игрока. Для контекстных тестов лучший результат автоматически не определяется.
          </p>
        </>
      )}
    </div>
  );
}
