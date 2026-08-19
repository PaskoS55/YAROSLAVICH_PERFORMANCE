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
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const query = await searchParams;
  const status = query.status ?? 'ALL';
  const q = (query.q ?? '').trim().toLowerCase();

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
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Игроки</h1>
        <Link href="/players/new" className="btn-primary">
          + Добавить игрока
        </Link>
      </div>

      <form className="relative max-w-xl">
        {status !== 'ALL' && <input type="hidden" name="status" value={status} />}
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          name="q"
          defaultValue={query.q ?? ''}
          placeholder="Поиск: фамилия, имя или ID… (Enter)"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm"
        />
      </form>

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Link
            key={c.key}
            href={`/players${c.key === 'ALL' ? '' : `?status=${c.key}`}${
              q ? `${c.key === 'ALL' ? '?' : '&'}q=${encodeURIComponent(q)}` : ''
            }`}
            className={`rounded-full border px-3 py-1 text-sm ${
              status === c.key
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
              <th className="px-4 py-2 text-left">Амплуа</th>
              <th className="px-4 py-2 text-right">Рост</th>
              <th className="px-4 py-2 text-left">Статус</th>
              <th className="px-4 py-2 text-left">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {players.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">
                  Никого не нашли. Измените фильтр или запрос.
                </td>
              </tr>
            )}
            {players.map((p) => (
              <tr key={p.id} className="relative">
                <td className="px-4 py-3">
                  <Link
                    href={`/players/${p.id}`}
                    className="font-medium hover:underline after:absolute after:inset-0"
                  >
                    {p.lastName} {p.firstName}
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
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.playerId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
