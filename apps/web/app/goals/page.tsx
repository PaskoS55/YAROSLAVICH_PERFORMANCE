import { prisma } from '../../lib/prisma';
import Link from 'next/link';
import { markGoalAchieved, createGoal } from './actions';
import GoalsHeader from './new-goal-section';
import ConfirmMarkButton from './confirm-mark-button';

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

function fmtVal(v: number) {
  return (Math.round(v * 100) / 100).toString().replace('.', ',');
}

const field = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm';
const label = 'block text-xs font-medium text-gray-500';

const statusPill: Record<string, string> = {
  DONE: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
  SOON: 'bg-yellow-100 text-yellow-800',
  WORK: 'bg-gray-100 text-gray-600',
};

const statusLabel: Record<string, string> = {
  DONE: 'Достигнута',
  OVERDUE: 'Просрочена',
  SOON: 'Срок скоро',
  WORK: 'В работе',
};

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: { f?: string };
}) {
  const f = searchParams.f ?? 'ALL';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    orderBy: { lastName: 'asc' },
  });
  const tests = await prisma.test.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
  });

  const goalsRaw = await prisma.playerGoal.findMany({
    where: { deletedAt: null },
    include: { player: true, test: true },
    orderBy: { targetDate: 'asc' },
  });

  const goals = [];
  for (const g of goalsRaw) {
    const last = await prisma.testResult.findFirst({
      where: { playerId: g.playerId, testId: g.testId, deletedAt: null },
      orderBy: { testSession: { DateTime: 'desc' } },
    });
    const current = last?.value ?? null;

    let statusKey: 'DONE' | 'OVERDUE' | 'SOON' | 'WORK';
    if (g.achieved) {
      statusKey = 'DONE';
    } else {
      const days = Math.ceil(
        (new Date(g.targetDate).getTime() - today.getTime()) / 86400000
      );
      statusKey = days < 0 ? 'OVERDUE' : days <= 14 ? 'SOON' : 'WORK';
    }

    let pct = 0;
    if (current !== null) {
      if (g.test.direction === 'HIGHER_IS_BETTER' && g.targetValue > 0) {
        pct = Math.min(100, Math.max(0, (current / g.targetValue) * 100));
      } else if (g.test.direction === 'LOWER_IS_BETTER' && current > 0) {
        pct = Math.min(100, Math.max(0, (g.targetValue / current) * 100));
      }
    }

    goals.push({ ...g, current, statusKey, pct });
  }

  const count = (k: string) =>
    goals.filter((g) =>
      k === 'ALL'
        ? true
        : k === 'WORK'
          ? g.statusKey === 'WORK' || g.statusKey === 'SOON'
          : g.statusKey === k
    ).length;

  const chips = [
    { key: 'ALL', label: `Все · ${goals.length}` },
    { key: 'WORK', label: `В работе · ${count('WORK')}` },
    { key: 'OVERDUE', label: `Просрочены · ${count('OVERDUE')}` },
    { key: 'DONE', label: `Достигнуты · ${count('DONE')}` },
  ];

  const filtered = goals.filter((g) =>
    f === 'ALL'
      ? true
      : f === 'WORK'
        ? g.statusKey === 'WORK' || g.statusKey === 'SOON'
        : g.statusKey === f
  );

  return (
    <div className="space-y-5 p-6">
      <GoalsHeader>
        <form action={createGoal} className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <label className={label}>
            Игрок *
            <select name="playerId" required className={field}>
              <option value="">Выберите игрока…</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.lastName} {p.firstName}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Тест *
            <select name="testId" required className={field}>
              <option value="">Выберите тест…</option>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Целевое значение *
            <input name="targetValue" type="number" step="0.1" required className={field} />
          </label>
          <label className={label}>
            Срок *
            <input name="targetDate" type="date" required className={field} />
          </label>
          <div className="flex items-end">
            <button className="btn-primary">Поставить цель</button>
          </div>
        </form>
      </GoalsHeader>

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Link
            key={c.key}
            href={`/goals${c.key === 'ALL' ? '' : `?f=${c.key}`}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              f === c.key
                ? 'chip-active'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">Игрок</th>
              <th className="px-4 py-2 text-left">Тест</th>
              <th className="px-4 py-2 text-right">Текущее</th>
              <th className="px-4 py-2 text-left">Цель</th>
              <th className="px-4 py-2 text-right">Срок</th>
              <th className="px-4 py-2 text-left">Статус</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  Целей пока нет — поставьте первую через «+ Новая цель».
                </td>
              </tr>
            )}
            {filtered.map((g) => (
              <tr key={g.id} className="relative">
                <td className="px-4 py-3">
                  <Link
                    href={`/players/${g.player.id}`}
                    className="font-medium hover:underline after:absolute after:inset-0"
                  >
                    {g.player.lastName} {g.player.firstName}
                  </Link>
                  <div className="text-xs text-gray-400">{g.player.playerId}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{g.test.name}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-900">
                  {g.current !== null ? `${fmtVal(g.current)} ${g.test.unit}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="font-mono text-gray-900">
                    {fmtVal(g.targetValue)} {g.test.unit}
                  </div>
                  {g.current !== null && (
                    <div
                      className="mt-1 h-1 w-16 rounded bg-gray-100"
                      title="Отношение текущего результата к цели"
                    >
                      <div
                        className="h-1 rounded"
                        style={{ width: `${g.pct}%`, background: 'var(--red)' }}
                      />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">{fmtDate(g.targetDate)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${statusPill[g.statusKey]}`}
                  >
                    {statusLabel[g.statusKey]}
                    {g.statusKey === 'DONE' && g.achievedAt ? ` ${fmtDate(g.achievedAt)}` : ''}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {!g.achieved && (
                    <form action={markGoalAchieved} className="relative z-10 inline">
                      <input type="hidden" name="id" value={g.id} />
                      <ConfirmMarkButton />
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