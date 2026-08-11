import { prisma } from '../../lib/prisma';
import Link from 'next/link';

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

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  const status = searchParams.status ?? 'ALL';
  const q = (searchParams.q ?? '').trim().toLowerCase();

  const all = await prisma.player.findMany({
    where: { deletedAt: null },
    orderBy: { lastName: 'asc' },
  });

  const players = all.filter((p) => {
    const okStatus = status === 'ALL' || p.status === status;
    const hay = `${p.lastName} ${p.firstName} ${p.middleName ?? ''} ${p.playerId}`.toLowerCase();
    return okStatus && (!q || hay.includes(q));
  });

  const countBy = (s: string) => all.filter((p) => p.status === s).length;

  const chips = [
    { key: 'ALL', label: `Все · ${all.length}` },
    { key: 'ACTIVE', label: `Активны · ${countBy('ACTIVE')}` },
    { key: 'INJURED', label: `Травмированы · ${countBy('INJURED')}` },
    { key: 'LIMITED', label: `Ограничения · ${countBy('LIMITED')}` },
    { key: 'INACTIVE', label: `Неактивны · ${countBy('INACTIVE')}` },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Игроки</h1>
        <form className="flex items-center gap-2">
          {status !== 'ALL' && <input type="hidden" name="status" value={status} />}
          <input
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="Поиск: ФИО или ID…"
            className="w-64 rounded border-2 px-3 py-1.5 text-sm"
          />
          <button className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">Найти</button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Link
            key={c.key}
            href={`/players${c.key === 'ALL' ? '' : `?status=${c.key}`}${
              q ? `${c.key === 'ALL' ? '?' : '&'}q=${encodeURIComponent(q)}` : ''
            }`}
            className={`rounded-full px-3 py-1 text-sm ${
              status === c.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 shadow hover:bg-gray-50'
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">ФИО</th>
              <th className="px-4 py-2 text-left">Амплуа</th>
              <th className="px-4 py-2 text-right">Рост</th>
              <th className="px-4 py-2 text-left">Статус</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {players.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  Никого не нашли. Измените фильтр или запрос.
                </td>
              </tr>
            )}
            {players.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-mono text-gray-500">{p.playerId}</td>
                <td className="px-4 py-3">
                  <Link href={`/players/${p.id}`} className="font-medium hover:underline">
                    {p.lastName} {p.firstName} {p.middleName ?? ''}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {positionLabels[p.position] ?? p.position}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {p.height ? `${p.height} см` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColors[p.status]}`}
                  >
                    {statusLabels[p.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/players/${p.id}/edit`}
                    className="text-sm hover:underline"
                    style={{ color: 'var(--red)' }}
                  >
                    Изменить
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}