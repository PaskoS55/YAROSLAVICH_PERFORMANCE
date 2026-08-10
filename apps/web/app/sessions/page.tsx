import { prisma } from '../../lib/prisma';
import Link from 'next/link';

const phaseLabels: Record<string, string> = {
  PRESEASON: 'Предсезонка',
  CAMP: 'Сборы',
  INSEASON: 'Сезон',
  POSTSEASON: 'Постсезон',
  RECOVERY: 'Восстановление',
};

const statusLabels: Record<string, string> = {
  FULL: 'Полное',
  PARTIAL: 'Частичное',
  INCOMPLETE: 'Не завершено',
  RESTRICTED: 'Ограничение',
};

const statusColors: Record<string, string> = {
  FULL: 'bg-green-100 text-green-800',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
  INCOMPLETE: 'bg-gray-100 text-gray-800',
  RESTRICTED: 'bg-red-100 text-red-800',
};

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

export default async function SessionsPage() {
  const sessions = await prisma.testSession.findMany({
    where: { deletedAt: null },
    orderBy: { DateTime: 'desc' },
    include: {
      player: { select: { id: true, firstName: true, lastName: true, playerId: true } },
      _count: { select: { testResults: true } },
    },
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Тестирования</h1>
        <span className="text-sm text-gray-500">Всего: {sessions.length}</span>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Игрок</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Фаза</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тестов</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sessions.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm font-mono">
                  <Link href={`/sessions/${s.id}`} className="text-blue-600 hover:underline">
                    {s.sessionId}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{fmtDate(s.DateTime)}</td>
                <td className="px-6 py-4 text-sm">
                  <Link href={`/players/${s.player.id}`} className="text-blue-600 hover:underline">
                    {s.player.lastName} {s.player.firstName} ({s.player.playerId})
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {phaseLabels[s.phase] || s.phase}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{s._count.testResults}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[s.status]}`}>
                    {statusLabels[s.status] || s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}