import { prisma } from '../../lib/prisma';

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

function fatColor(pct: number | null): string {
  if (pct === null) return 'text-gray-400';
  if (pct < 8) return 'text-green-700';
  if (pct < 14) return 'text-blue-700';
  if (pct < 20) return 'text-yellow-700';
  return 'text-red-700';
}

function phaseColor(p: number | null): string {
  if (p === null) return 'text-gray-400';
  if (p >= 6.5) return 'text-green-700';
  if (p >= 5.0) return 'text-blue-700';
  if (p >= 4.0) return 'text-yellow-700';
  return 'text-red-700';
}

export default async function BodyCompositionPage() {
  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    orderBy: { playerId: 'asc' },
    include: {
      bodyCompositions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { testSession: { select: { DateTime: true, sessionId: true } } },
      },
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Состав тела</h1>
        <p className="mt-1 text-sm text-gray-500">
          Последние замеры биоимпеданса по каждому игроку.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Игрок</th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Дата</th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Масса</th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">% жира</th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">БЖМ</th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Фазовый угол</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {players.map((p) => {
              const b = p.bodyCompositions[0];
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="font-medium">{p.lastName} {p.firstName}</div>
                    <div className="text-xs text-gray-400">{p.playerId}</div>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500">
                    {b ? fmtDate(b.testSession.DateTime) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {b?.mass_kg !== null && b?.mass_kg !== undefined
                      ? `${b.mass_kg.toFixed(1)} кг`
                      : '—'}
                  </td>
                  <td className={`px-4 py-2 text-right font-mono font-semibold ${fatColor(b?.fat_pct ?? null)}`}>
                    {b?.fat_pct !== null && b?.fat_pct !== undefined
                      ? `${b.fat_pct.toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {b?.ffm_kg !== null && b?.ffm_kg !== undefined
                      ? `${b.ffm_kg.toFixed(1)} кг`
                      : '—'}
                  </td>
                  <td className={`px-4 py-2 text-right font-mono font-semibold ${phaseColor(b?.phase_angle ?? null)}`}>
                    {b?.phase_angle !== null && b?.phase_angle !== undefined
                      ? `${b.phase_angle.toFixed(2)}°`
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500">
        Цветовые зоны ориентировочные: <span className="text-green-700">●</span> оптимально,
        <span className="text-blue-700 ml-1">●</span> норма,
        <span className="text-yellow-700 ml-1">●</span> внимание,
        <span className="text-red-700 ml-1">●</span> выход за пределы.
      </div>
    </div>
  );
}