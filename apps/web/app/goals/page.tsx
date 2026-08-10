import { prisma } from '../../lib/prisma';
import { markGoalAchieved } from './actions';

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

export default async function GoalsPage() {
  const goals = await prisma.playerGoal.findMany({
    where: { deletedAt: null },
    include: { player: true, test: true },
    orderBy: { targetDate: 'asc' },
  });

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Цели</h1>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Игрок</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Тест</th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Цель</th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Срок</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Статус</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {goals.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  {g.player.lastName} {g.player.firstName}{' '}
                  <span className="text-xs text-gray-400">({g.player.playerId})</span>
                </td>
                <td className="px-4 py-2">{g.test.name}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {g.targetValue} {g.test.unit}
                </td>
                <td className="px-4 py-2 text-right">{fmtDate(g.targetDate)}</td>
                <td className="px-4 py-2">
                  {g.achieved ? (
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                      Достигнута {fmtDate(g.achievedAt)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                      В работе
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {!g.achieved && (
                    <form action={markGoalAchieved} className="inline">
                      <input type="hidden" name="id" value={g.id} />
                      <button className="text-sm text-blue-600 hover:underline">Отметить</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}