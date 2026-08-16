import { prisma } from '../../lib/prisma';
import Link from 'next/link';
import ResolveFlagButton from './resolve-flag-button';
import { resolveFlag } from './actions';

const fieldLabels: Record<string, string> = {
  value: 'Значение результата',
  range: 'QC-диапазон',
  delta: 'Изменение между сессиями',
  date: 'Дата сессии',
  mass: 'Масса тела',
  fat: 'Процент жира',
};

const reasonLabels: Record<string, string> = {
  'manual:verified': 'Проверено: значение верное',
  'manual:fixed': 'Исправлено в исходных данных',
  'manual:other': 'Другое',
  'auto:fixed': 'Исправлено в исходных данных (автоматически)',
  manual: 'Решено вручную',
};
function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

export default async function QCPage() {
  const flags = await prisma.qCFlag.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      testResult: { include: { test: true, player: true } },
    },
  });

  const unresolved = flags.filter((f) => !f.resolved).length;
  const resolved = flags.filter((f) => f.resolved).length;
  const failedCount = await prisma.testResult.count({
    where: { qcStatus: 'FAILED', deletedAt: null },
  });

  const failedResults = await prisma.testResult.findMany({
    where: { qcStatus: 'FAILED', deletedAt: null },
    include: {
      test: true,
      player: true,
      testSession: { select: { id: true, sessionId: true, DateTime: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const flagByResult = new Map(flags.map((f) => [f.testResultId, f]));

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Контроль данных</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-800">
            Открытых: {unresolved}
          </span>
          <span className="rounded-full bg-green-100 px-3 py-1 font-semibold text-green-800">
            Решённых: {resolved}
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">
            FAILED: {failedCount}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-bold">Результаты со статусом FAILED</h2>
        {failedResults.length === 0 ? (
          <p className="text-sm text-gray-500">Нет результатов со статусом FAILED.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Игрок</th>
                  <th className="whitespace-nowrap px-4 py-2 text-left">Дата</th>
                  <th className="px-4 py-2 text-left">Тест</th>
                  <th className="px-4 py-2 text-right">Значение</th>
                  <th className="px-4 py-2 text-left">QC-диапазон</th>
                  <th className="px-4 py-2 text-left">Флаг</th>
                  <th className="px-4 py-2 text-left">Сессия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {failedResults.map((r) => {
                  const flag = flagByResult.get(r.id);
                  return (
                    <tr key={r.id} className="relative">
                      <td className="px-4 py-3">
                        <Link
                          href={`/sessions/${r.testSession.id}`}
                          className="after:absolute after:inset-0"
                          aria-label={`Открыть сессию ${r.testSession.sessionId}`}
                        />
                        <Link
                          href={`/players/${r.player.id}`}
                          className="relative z-10 font-medium hover:underline"
                        >
                          {r.player.lastName} {r.player.firstName}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {fmtDate(r.testSession.DateTime)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.test.name}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-red-700">
                        {r.value} {r.test.unit}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {r.test.qcMin ?? '…'} – {r.test.qcMax ?? '…'}
                      </td>
                      <td className="px-4 py-3">
                        {!flag ? (
                          <span className="text-gray-400">—</span>
                        ) : flag.resolved ? (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                            Решён
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                            Открыт
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {r.testSession.sessionId}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-bold">Журнал QC-флагов</h2>
        {flags.length === 0 ? (
          <p className="text-sm text-gray-500">Флагов пока нет.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Дата</th>
                  <th className="px-4 py-2 text-left">Игрок</th>
                  <th className="px-4 py-2 text-left">Что проверено</th>
                  <th className="px-4 py-2 text-left">Ожидается / факт</th>
                  <th className="px-4 py-2 text-left">Статус</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {flags.map((f) => (
                  <tr key={f.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {fmtDate(f.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {f.testResult.player.lastName} {f.testResult.player.firstName}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {fieldLabels[f.field] ?? f.field}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {f.expected} → {f.actual}
                    </td>
                    <td className="px-4 py-3">
                      {f.resolved ? (
                        <div>
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                            Решён {fmtDate(f.resolvedAt)}
                          </span>
                          <div className="mt-1 text-xs text-gray-400">
                            {reasonLabels[f.resolvedBy ?? 'manual'] ?? f.resolvedBy}
                          </div>
                        </div>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                          Открыт
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!f.resolved && (
                        <form action={resolveFlag} className="relative z-10 inline">
                          <input type="hidden" name="id" value={f.id} />
                          <input type="hidden" name="reason" defaultValue="manual" />
                          <ResolveFlagButton />
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}