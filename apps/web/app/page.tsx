import { prisma } from '../lib/prisma';
import Link from 'next/link';

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

function fmtShort(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

function plural(n: number, forms: [string, string, string]) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

const phaseLabels: Record<string, string> = {
  PRESEASON: 'Предсезонка',
  CAMP: 'Сборы',
  INSEASON: 'Сезон',
  POSTSEASON: 'Постсезон',
  RECOVERY: 'Восстановление',
};

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
      include: {
        player: { select: { id: true, lastName: true, firstName: true } },
        _count: { select: { testResults: true } },
      },
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
      wide: false,
      icon: ic(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
    },
    {
      label: 'Травмированы',
      value: injuredPlayers,
      href: '/players?status=INJURED',
      sub: injuredPlayers > 0 ? 'требуют внимания' : 'все здоровы',
      danger: injuredPlayers > 0,
      wide: false,
      icon: ic(<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></>),
    },
    {
      label: 'Сессий проведено',
      value: sessionsTotal,
      href: '/sessions',
      sub: sessions30 > 0 ? `+${sessions30} за 30 дней` : 'нет новых за 30 дней',
      danger: false,
      wide: false,
      icon: ic(<><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></>),
    },
    {
      label: 'Результатов записано',
      value: resultsTotal,
      href: '/sessions',
      sub: results30 > 0 ? `+${results30} за 30 дней` : 'нет новых за 30 дней',
      danger: false,
      wide: false,
      icon: ic(<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></>),
    },
    {
      label: 'Целей в работе',
      value: goalsActive,
      href: '/goals',
      sub: 'автопроверка достижения',
      danger: false,
      wide: true,
      icon: ic(<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Обзор команды</h1>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600">
            Последнее тестирование · {lastSession ? fmtShort(lastSession.DateTime) : '—'}
          </span>
          <Link href="/testing/team" className="btn-primary w-full text-center sm:w-auto">
            + Провести тестирование
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className={`rounded-lg border p-4 transition-colors ${
              k.wide ? 'col-span-2 lg:col-span-1' : ''
            } ${
              k.danger
                ? 'border-red-200 bg-red-50 hover:border-red-300'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">{k.label}</span>
              <span className={k.danger ? 'text-red-600' : 'text-gray-400'}>{k.icon}</span>
            </div>
            <div
              className={`mt-2 text-4xl font-extrabold tracking-tight ${
                k.danger ? 'text-red-700' : 'text-gray-900'
              }`}
            >
              {k.value}
            </div>
            <div className={`mt-1 text-[11px] ${k.danger ? 'font-medium text-red-600' : 'text-gray-400'}`}>
              {k.sub}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Последние сессии</h2>
            <Link href="/sessions" className="link-action text-sm hover:underline">
              Все сессии →
            </Link>
          </div>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-gray-200">
              {recentSessions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-500">
                    Сессий пока нет —{' '}
                    <Link href="/testing/team" className="link-action font-semibold hover:underline">
                      провести первое тестирование →
                    </Link>
                  </td>
                </tr>
              )}
              {recentSessions.map((s) => (
                <tr key={s.id}>
                  <td className="py-2.5">
                    <Link href={`/players/${s.player.id}`} className="font-medium hover:underline">
                      {s.player.lastName} {s.player.firstName}
                    </Link>
                    <div className="text-[11px] font-mono text-gray-400">
                      {s.sessionId} · {phaseLabels[s.phase] ?? s.phase}
                    </div>
                  </td>
                  <td className="py-2.5 text-gray-500">{fmtDate(s.DateTime)}</td>
                  <td className="py-2.5 text-right font-mono text-gray-600">
                    {s._count.testResults} {plural(s._count.testResults, ['тест', 'теста', 'тестов'])}
                  </td>
                  <td className="py-2.5 text-right">
                    <Link href={`/sessions/${s.id}`} className="link-action text-sm hover:underline">
                      открыть →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          {injuredList.length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="text-sm font-bold text-red-800">⚠ Травмированные игроки</div>
              <ul className="mt-2 space-y-1">
                {injuredList.map((p) => (
                  <li key={p.id}>
                    <Link href={`/players/${p.id}`} className="text-sm text-red-800 hover:underline">
                      {p.lastName} {p.firstName} ({p.playerId}) →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
              ✓ Все игроки здоровы
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs font-medium text-gray-500">Быстрые действия</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/analytics"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              >
                Динамика
              </Link>
              <Link
                href="/compare"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              >
                Сравнение
              </Link>
              <Link
                href="/reports"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              >
                Отчёты
              </Link>
              <Link
                href="/goals"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              >
                Цели
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}