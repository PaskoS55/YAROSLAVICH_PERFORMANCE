import { prisma } from '../../lib/prisma';
import { markGoalAchieved, createGoal, syncGoals } from './actions';

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
  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    orderBy: { lastName: 'asc' },
  });
  const tests = await prisma.test.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Цели</h1>
        <form action={syncGoals}>
          <button className="rounded bg-blue-600 px-4 py-2 text-sm text-white">
            Проверить достижение
          </button>
        </form>
      </div>

      <form
        action={createGoal}
        className="grid grid-cols-1 gap-3 rounded-lg bg-white p-4 shadow md:grid-cols-5"
      >
        <select name="playerId" required className="rounded border-2 px-2 py-1 text-sm">
          <option value="">Игрок…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.lastName} {p.firstName}
            </option>
          ))}
        </select>
        <select name="testId" required className="rounded border-2 px-2 py-1 text-sm">
          <option value="">Тест…</option>
          {tests.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          name="targetValue"
          required
          placeholder="Целевое значение"
          className="rounded border-2 px-2 py-1 text-sm"
        />
        <input name="targetDate" type="date" required className="rounded border-2 px-2 py-1 text-sm" />
        <button className="rounded bg-blue-600 px-4 py-1 text-sm text-white">
          Поставить цель
        </button>
      </form>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">Игрок</th>
              <th className="px-4 py-2 text-left">Тест</th>
              <th className="px-4 py-2 text-right">Цель</th>
              <th className="px-4 py-2 text-right">Срок</th>
              <th className="px-4 py-2 text-left">Статус</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
                   <tbody className="divide-y divide-gray-200">
            {goals.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  Целей пока нет — поставьте первую через форму выше.
                </td>
              </tr>
            )}
            {goals.map((g) => (
              <tr key={g.id}>
                <td className="px-4 py-3">
                  {g.player.lastName} {g.player.firstName}{' '}
                  <span className="text-xs text-gray-400">({g.player.playerId})</span>
                </td>
                <td className="px-4 py-3">{g.test.name}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {g.targetValue} {g.test.unit}
                </td>
                <td className="px-4 py-3 text-right">{fmtDate(g.targetDate)}</td>
                <td className="px-4 py-3">
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
                <td className="px-4 py-3 text-right">
                  {!g.achieved && (
                    <form action={markGoalAchieved} className="inline">
                      <input type="hidden" name="id" value={g.id} />
                      <button className="text-sm hover:underline" style={{ color: 'var(--red)' }}>
                        Отметить
                      </button>
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