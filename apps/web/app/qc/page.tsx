import { prisma } from '../../lib/prisma';
import Link from 'next/link';
import { resolveFlag } from './actions';

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

export default async function QCPage() {
  const flags = await prisma.qCFlag.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      testResult: {
        include: {
          test: true,
          player: true,
          testSession: { select: { sessionId: true, DateTime: true } },
        },
      },
    },
  });

  const unresolved = flags.filter((f) => !f.resolved).length;
  const resolved = flags.filter((f) => f.resolved).length;

  const failedResults = await prisma.testResult.findMany({
    where: { qcStatus: 'FAILED', deletedAt: null },
    include: { test: true, player: true, testSession: { select: { sessionId: true, DateTime: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Контроль данных</h1>
        <div className="flex gap-4 text-sm">
          <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">
            Открытых: <b>{unresolved}</b>
          </span>
          <span className="rounded-full bg-green-100 px-3 py-1 text-green-800">
            Решённых: <b>{resolved}</b>
          </span>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-3 text-lg font-bold">Результаты с QC-ошибкой (FAILED)</h2>
        {failedResults.length === 0 ? (
          <p className="text-sm text-gray-500">Нет результатов вне QC-диапазона.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4">Дата</th>
                <th className="py-2 pr-4">Сессия</th>
                <th className="py-2 pr-4">Игрок</th>
                <th className="py-2 pr-4">Тест</th>
                <th className="py-2 pr-4">Значение</th>
                <th className="py-2">QC-диапазон</th>
              </tr>
            </thead>
            <tbody>
              {failedResults.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 text-gray-500">{fmtDate(r.testSession.DateTime)}</td>
                  <td className="py-2 font-mono text-gray-500">
                    <Link href={`/sessions/${r.testSessionId}`} className="text-blue-600 hover:underline">
                      {r.testSession.sessionId}
                    </Link>
                  </td>
                  <td className="py-2">
                    <Link href={`/players/${r.player.id}`} className="text-blue-600 hover:underline">
                      {r.player.lastName} {r.player.firstName}
                    </Link>
                  </td>
                  <td className="py-2">{r.test.name}</td>
                  <td className="py-2 font-mono text-red-700 font-semibold">{r.value} {r.test.unit}</td>
                  <td className="py-2 text-gray-500">
                    {r.test.qcMin ?? '…'} – {r.test.qcMax ?? '…'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-3 text-lg font-bold">Журнал QC-флагов</h2>
        {flags.length === 0 ? (
          <p className="text-sm text-gray-500">Флагов пока нет.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4">Дата</th>
                <th className="py-2 pr-4">Игрок</th>
                <th className="py-2 pr-4">Поле</th>
                <th className="py-2 pr-4">Ожидается</th>
                <th className="py-2 pr-4">Факт</th>
                <th className="py-2 pr-4">Статус</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="py-2 text-gray-500">{fmtDate(f.createdAt)}</td>
                  <td className="py-2">{f.testResult.player.lastName}</td>
                  <td className="py-2">{f.field}</td>
                  <td className="py-2 font-mono">{f.expected}</td>
                  <td className="py-2 font-mono">{f.actual}</td>
                  <td className="py-2">
                    {f.resolved ? (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                        Решено {fmtDate(f.resolvedAt)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                        Открыт
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {!f.resolved && (
                      <form action={resolveFlag} className="inline">
                        <input type="hidden" name="id" value={f.id} />
                        <button className="text-xs text-blue-600 hover:underline">Отметить</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}