import { prisma } from '../../lib/prisma';

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

export default async function ReportsPage() {
  const sessions = await prisma.testSession.findMany({
    where: { deletedAt: null },
    orderBy: { DateTime: 'desc' },
    include: { player: { select: { lastName: true, firstName: true } } },
  });

  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    orderBy: { lastName: 'asc' },
  });

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Отчёты и экспорт</h1>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-3 text-lg font-bold">Командная сводка</h2>
        <p className="mb-3 text-sm text-gray-600">
          Матрица «все игроки × все тесты» с последними результатами.
        </p>
        <a
          href="/api/export?type=team"
          className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Скачать CSV
        </a>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-3 text-lg font-bold">Отчёт по сессии</h2>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-gray-200">
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 font-mono text-gray-500">{s.sessionId}</td>
                  <td className="py-2">{fmtDate(s.DateTime)}</td>
                  <td className="py-2">
                    {s.player.lastName} {s.player.firstName}
                  </td>
                  <td className="py-2 text-right">
                    <a
                      href={`/api/export?type=session&id=${s.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Скачать ↓
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-3 text-lg font-bold">Отчёт по игроку</h2>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-gray-200">
              {players.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 font-mono text-gray-500">{p.playerId}</td>
                  <td className="py-2">
                    {p.lastName} {p.firstName} {p.middleName ?? ''}
                  </td>
                  <td className="py-2 text-right">
                    <a
                      href={`/api/export?type=player&id=${p.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Скачать ↓
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Файлы CSV: разделитель «;», кодировка UTF-8 с BOM — корректно открываются в Excel.
      </p>
    </div>
  );
}