import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function PlayersPage() {
  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    orderBy: { lastName: 'asc' },
    include: {
      team: { select: { name: true, code: true } },
    },
  });

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

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Игроки</h1>
        <span className="text-sm text-gray-500">
          Всего: {players.length}
        </span>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ФИО
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Амплуа
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Рост
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {players.map((player) => (
              <tr key={player.id} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                  <Link href={`/players/${player.id}`}>
                    {player.playerId}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <Link href={`/players/${player.id}`}>
                    {player.lastName} {player.firstName} {player.middleName || ''}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {positionLabels[player.position] || player.position}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {player.height ? `${player.height} см` : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[player.status]}`}>
                    {statusLabels[player.status] || player.status}
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