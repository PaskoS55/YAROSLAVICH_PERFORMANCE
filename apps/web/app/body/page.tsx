import { prisma } from '../../lib/prisma';
import { createBodyComposition } from './actions';

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
      <h1 className="text-3xl font-bold">Состав тела</h1>

      <form
        action={createBodyComposition}
        className="grid grid-cols-1 gap-3 rounded-lg bg-white p-4 shadow md:grid-cols-6"
      >
        <select name="playerId" required className="rounded border-2 px-2 py-1 text-sm">
          <option value="">Игрок…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.lastName} {p.firstName}
            </option>
          ))}
        </select>
        <input name="date" type="date" required className="rounded border-2 px-2 py-1 text-sm" />
        <input name="mass" required placeholder="Масса, кг" className="rounded border-2 px-2 py-1 text-sm" />
        <input name="fat" required placeholder="Жир, %" className="rounded border-2 px-2 py-1 text-sm" />
        <input name="ffm" required placeholder="БЖМ, кг" className="rounded border-2 px-2 py-1 text-sm" />
        <input name="phase" placeholder="Фазовый угол, °" className="rounded border-2 px-2 py-1 text-sm" />
        <button className="rounded bg-blue-600 px-4 py-1 text-sm text-white md:col-span-6">
          Сохранить замер
        </button>
      </form>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">Игрок</th>
              <th className="px-4 py-2 text-right">Дата</th>
              <th className="px-4 py-2 text-right">Масса</th>
              <th className="px-4 py-2 text-right">% жира</th>
              <th className="px-4 py-2 text-right">БЖМ</th>
              <th className="px-4 py-2 text-right">Фазовый угол</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {players.map((p) => {
              const b = p.bodyCompositions[0];
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {p.lastName} {p.firstName}
                    </div>
                    <div className="text-xs text-gray-400">{p.playerId}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {b ? fmtDate(b.testSession.DateTime) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {b ? `${b.mass_kg.toFixed(1)} кг` : '—'}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${fatColor(b?.fat_pct ?? null)}`}>
                    {b ? `${b.fat_pct.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {b ? `${b.ffm_kg.toFixed(1)} кг` : '—'}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${phaseColor(b?.phase_angle ?? null)}`}>
                    {b ? `${b.phase_angle.toFixed(2)}°` : '—'}
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