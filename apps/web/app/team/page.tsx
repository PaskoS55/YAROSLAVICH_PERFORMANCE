import { prisma } from '../../lib/prisma';
import Link from 'next/link';
import { updatePlayerStatus } from './actions';

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

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

function age(birthDate: Date | null) {
  if (!birthDate) return null;
  const diff = Date.now() - new Date(birthDate).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

export default async function TeamPage() {
  const team = await prisma.team.findFirst({
    include: { organization: true },
  });
  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    orderBy: { playerId: 'asc' },
  });

  const byPos = new Map<string, number>();
  for (const p of players) {
    byPos.set(p.position, (byPos.get(p.position) ?? 0) + 1);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{team?.name ?? 'Команда'}</h1>
          <div className="text-sm text-gray-500">{team?.organization.name}</div>
        </div>
        <div className="text-right text-sm text-gray-500">
          <div>Всего игроков: <b className="text-gray-900">{players.length}</b></div>
          <div>Средний возраст: <b className="text-gray-900">{Math.round(players.reduce((s, p) => s + (age(p.birthDate) ?? 0), 0) / Math.max(players.length, 1))}</b></div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from(byPos.entries()).map(([pos, count]) => (
          <span key={pos} className="rounded-full bg-white px-3 py-1 text-xs shadow">
            {positionLabels[pos] ?? pos}: <b>{count}</b>
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">№</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">ID</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">ФИО</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Позиция</th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Возраст</th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Рост</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Статус</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {players.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-gray-500">{p.number ?? '—'}</td>
                <td className="px-4 py-2 font-mono">{p.playerId}</td>
                <td className="px-4 py-2">
                  <Link href={`/players/${p.id}`} className="text-blue-600 hover:underline">
                    {p.lastName} {p.firstName} {p.middleName ?? ''}
                  </Link>
                </td>
                <td className="px-4 py-2 text-gray-500">{positionLabels[p.position] ?? p.position}</td>
                <td className="px-4 py-2 text-right">{age(p.birthDate) ?? '—'}</td>
                <td className="px-4 py-2 text-right">{p.height ? `${p.height} см` : '—'}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColors[p.status]}`}>
                    {statusLabels[p.status]}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <form action={updatePlayerStatus} className="inline-flex items-center gap-1">
                    <input type="hidden" name="id" value={p.id} />
                    <select name="status" defaultValue={p.status} className="rounded border px-1 py-0.5 text-xs">
                      <option value="ACTIVE">Активен</option>
                      <option value="LIMITED">Ограничение</option>
                      <option value="INJURED">Травмирован</option>
                      <option value="INACTIVE">Неактивен</option>
                    </select>
                    <button className="text-xs text-blue-600 hover:underline">→</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}