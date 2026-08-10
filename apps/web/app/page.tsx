import { prisma } from '../lib/prisma';
import Link from 'next/link';

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

export default async function HomePage() {
  const [playersTotal, activePlayers, injuredPlayers, sessionsTotal, resultsTotal, goalsActive, lastSession, recentSessions, injuredList] =
    await Promise.all([
      prisma.player.count({ where: { deletedAt: null } }),
      prisma.player.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      prisma.player.count({ where: { deletedAt: null, status: 'INJURED' } }),
      prisma.testSession.count({ where: { deletedAt: null } }),
      prisma.testResult.count({ where: { deletedAt: null } }),
      prisma.playerGoal.count({ where: { deletedAt: null, achieved: false } }),
      prisma.testSession.findFirst({
        where: { deletedAt: null },
        orderBy: { DateTime: 'desc' },
        select: { DateTime: true },
      }),
      prisma.testSession.findMany({
        where: { deletedAt: null },
        orderBy: { DateTime: 'desc' },
        take: 5,
        include: { player: { select: { lastName: true, firstName: true } } },
      }),
      prisma.player.findMany({ where: { deletedAt: null, status: 'INJURED' } }),
    ]);

  const kpis = [
    { label: 'Игроков в составе', value: playersTotal, href: '/players' },
    { label: 'Активных', value: activePlayers, href: '/players' },
    { label: 'Травмированы', value: injuredPlayers, href: '/players' },
    { label: 'Сессий проведено', value: sessionsTotal, href: '/sessions' },
    { label: 'Результатов записано', value: resultsTotal, href: '/sessions' },
    { label: 'Целей в работе', value: goalsActive, href: '/players' },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Главная</h1>
        <div className="text-sm text-gray-500">
          Последнее тестирование: <b>{lastSession ? fmtDate(lastSession.DateTime) : '—'}</b>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="rounded-lg bg-white p-4 shadow hover:shadow-md">
            <div className="text-3xl font-bold text-blue-600">{k.value}</div>
            <div className="mt-1 text-xs text-gray-500">{k.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Последние сессии</h2>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-gray-200">
              {recentSessions.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 font-mono text-gray-500">{s.sessionId}</td>
                  <td className="py-2">{fmtDate(s.DateTime)}</td>
                  <td className="py-2">
                    <Link href={`/players/${s.player.id}`} className="text-blue-600 hover:underline">
                      {s.player.lastName} {s.player.firstName}
                    </Link>
                  </td>
                  <td className="py-2 text-right">
                    <Link href={`/sessions/${s.id}`} className="text-blue-600 hover:underline">
                      открыть →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link href="/sessions" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Все сессии →
          </Link>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Травмированные игроки</h2>
          {injuredList.length === 0 ? (
            <p className="text-sm text-gray-500">Нет травмированных.</p>
          ) : (
            <ul className="space-y-2">
              {injuredList.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded bg-red-50 px-3 py-2">
                  <Link href={`/players/${p.id}`} className="text-sm text-red-800 hover:underline">
                    {p.lastName} {p.firstName} ({p.playerId})
                  </Link>
                  <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                    Травмирован
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-2 mt-6 text-lg font-bold">Быстрые действия</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/testing/team" className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">
              Командный ввод
            </Link>
            <Link href="/dynamics" className="rounded bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200">
              Динамика
            </Link>
            <Link href="/compare" className="rounded bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200">
              Сравнение
            </Link>
            <Link href="/analytics" className="rounded bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200">
              Графики
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}