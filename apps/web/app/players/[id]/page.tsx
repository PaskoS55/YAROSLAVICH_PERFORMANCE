import { prisma } from '../../../lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const positionLabels: Record<string, string> = {
  outside_hitter: 'Доигровщик',
  opposite: 'Диагональный',
  middle_blocker: 'Центральный блокирующий',
  setter: 'Связующий',
  libero: 'Либеро',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Активен',
  INJURED: 'Травмирован',
  LIMITED: 'Ограничение',
  INACTIVE: 'Неактивен',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INJURED: 'bg-red-100 text-red-800',
  LIMITED: 'bg-yellow-100 text-yellow-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
};

const phaseLabels: Record<string, string> = {
  PRESEASON: 'Предсезонка',
  CAMP: 'Сборы',
  INSEASON: 'Сезон',
  POSTSEASON: 'Постсезон',
  RECOVERY: 'Восстановление',
};

const sessionStatusLabels: Record<string, string> = {
  FULL: 'Полное',
  PARTIAL: 'Частичное',
  INCOMPLETE: 'Не завершено',
  RESTRICTED: 'Ограничение',
};

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

export default async function PlayerCardPage({ params }: { params: { id: string } }) {
  const player = await prisma.player.findUnique({
    where: { id: params.id },
    include: {
      team: true,
      testSessions: {
        where: { deletedAt: null },
        orderBy: { DateTime: 'desc' },
        include: { testResults: { include: { test: true } } },
      },
      goals: { include: { test: true } },
    },
  });

  if (!player || player.deletedAt) notFound();

  const lastSession = player.testSessions[0];

  return (
         <div className="flex items-center justify-between text-sm text-gray-500">
        <div>
          <Link href="/players" className="text-blue-600 hover:underline">Игроки</Link> / {player.playerId}
        </div>
        <Link
          href={`/players/${player.id}/edit`}
          className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
        >
          Редактировать
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6 flex items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-3xl font-bold text-gray-500">
          {player.lastName[0]}{player.firstName[0]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {player.lastName} {player.firstName} {player.middleName || ''}
            </h1>
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[player.status]}`}>
              {statusLabels[player.status]}
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-600 grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>Амплуа: <b>{positionLabels[player.position] || player.position}</b></div>
            <div>Рост: <b>{player.height ? `${player.height} см` : '—'}</b></div>
            <div>Дата рождения: <b>{fmtDate(player.birthDate)}</b></div>
            <div>Команда: <b>{player.team.name}</b></div>
          </div>
        </div>
        <div className="text-right text-sm text-gray-500">
          <div>Последнее тестирование</div>
          <div className="text-lg font-semibold text-gray-900">
            {lastSession ? fmtDate(lastSession.DateTime) : '—'}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">
          История тестирований ({player.testSessions.length})
        </h2>
        {player.testSessions.length === 0 && (
          <p className="text-gray-500">Тестирований пока нет.</p>
        )}
        <div className="space-y-6">
          {player.testSessions.map((s) => (
            <div key={s.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">
                  {fmtDate(s.DateTime)} — {phaseLabels[s.phase] || s.phase}
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                  {sessionStatusLabels[s.status] || s.status}
                </span>
              </div>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-1 pr-4">Тест</th>
                    <th className="py-1 pr-4">Результат</th>
                    <th className="py-1">QC</th>
                  </tr>
                </thead>
                <tbody>
                  {s.testResults.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-1 pr-4">{r.test.name}</td>
                      <td className="py-1 pr-4 font-mono">{r.value} {r.test.unit}</td>
                      <td className="py-1">
                        {r.qcStatus === 'PASSED' ? '✓' : r.qcStatus === 'FAILED' ? '✗' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Цели ({player.goals.length})</h2>
        {player.goals.length === 0 && <p className="text-gray-500">Целей пока нет.</p>}
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-1 pr-4">Тест</th>
              <th className="py-1 pr-4">Цель</th>
              <th className="py-1 pr-4">Срок</th>
              <th className="py-1">Статус</th>
            </tr>
          </thead>
          <tbody>
            {player.goals.map((g) => (
              <tr key={g.id} className="border-b last:border-0">
                <td className="py-1 pr-4">{g.test.name}</td>
                <td className="py-1 pr-4 font-mono">{g.targetValue} {g.test.unit}</td>
                <td className="py-1 pr-4">{fmtDate(g.targetDate)}</td>
                <td className="py-1">{g.achieved ? '✅ Достигнута' : '⏳ В работе'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}