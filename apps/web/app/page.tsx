import { prisma } from '../lib/prisma';
import Link from 'next/link';

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

const ic = (paths: React.ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);

export default async function HomePage() {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [
    playersTotal,
    activePlayers,
    injuredPlayers,
    sessionsTotal,
    resultsTotal,
    goalsActive,
    sessions30,
    results30,
    lastSession,
    recentSessions,
    injuredList,
  ] = await Promise.all([
    prisma.player.count({ where: { deletedAt: null } }),
    prisma.player.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    prisma.player.count({ where: { deletedAt: null, status: 'INJURED' } }),
    prisma.testSession.count({ where: { deletedAt: null } }),
    prisma.testResult.count({ where: { deletedAt: null } }),
    prisma.playerGoal.count({ where: { deletedAt: null, achieved: false } }),
    prisma.testSession.count({ where: { deletedAt: null, DateTime: { gte: since } } }),
    prisma.testResult.count({
      where: { deletedAt: null, testSession: { DateTime: { gte: since } } },
    }),
    prisma.testSession.findFirst({
      where: { deletedAt: null },
      orderBy: { DateTime: 'desc' },
      select: { DateTime: true },
    }),
    prisma.testSession.findMany({
      where: { deletedAt: null },
      orderBy: { DateTime: 'desc' },
      take: 5,
      include: { player: { select: { id: true, lastName: true, firstName: true } } },
    }),
    prisma.player.findMany({ where: { deletedAt: null, status: 'INJURED' } }),
  ]);

  const kpis = [
    {
      label: 'Игроков в составе',
      value: playersTotal,
      href: '/players',
      sub: `${activePlayers} активных`,
      danger: false,
      icon: ic(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
    },
    {
      label: 'Травмированы',
      value: injuredPlayers,
      href: '/players?status=INJURED',
      sub: injuredPlayers > 0 ? 'требуют внимания' : 'все здоровы',
      danger: injuredPlayers > 0,
      icon: ic(<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></>),
    },
    {
      label: 'Сессий проведено',
      value: sessionsTotal,
      href: '/sessions',
      sub: `+${sessions30} за 30 дней`,
      danger: false,
      icon: ic(<><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></>),
    },
    {
      label: 'Результатов записано',
      value: resultsTotal,
      href: '/sessions',
      sub: `+${results30} за 30 дней`,
      danger: false,
      icon: ic(<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></>),
    },
    {
      label: 'Целей в работе',
      value: goalsActive,
      href: '/goals',
      sub: 'автопроверка достижения',
      danger: false,
      icon: ic(<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Главная</h1>
        <div className="text-sm text-gray-500">
          Последнее тестирование: <b>{lastSession ? fmtDate(lastSession.DateTime) : '—'}</b>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="rounded-lg bg-white p-4 shadow hover:shadow-md">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                k.danger ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {k.icon}
            </span>
            <div className="mt-3 text-3xl font-extrabold text-blue-600">{k.value}</div>
            <div className="mt-1 text-xs font-medium text-gray-500">{k.label}</div>
            <div className={`mt-1 text-[11px] ${k.danger ? 'text-red-600' : 'text-gray-400'}`}>
              {k.sub}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Последние сессии</h2>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-gray-200">
              {recentSessions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-gray-500">
                    Сессий пока нет —{' '}
                    <Link
                      href="/testing/team"
                      className="font-semibold hover:underline"
                      style={{ color: 'var(--red)' }}
                    >
                      провести первое тестирование →
                    </Link>
                  </td>
                </tr>
              )}
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
            <Link href="/analytics" className="rounded bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200">
              Динамика
            </Link>
            <Link href="/compare" className="rounded bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200">
              Сравнение
            </Link>
            <Link href="/reports" className="rounded bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200">
              Отчёты
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}