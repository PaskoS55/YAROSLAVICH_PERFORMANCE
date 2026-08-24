import { prisma } from '../../lib/prisma';
import { requireAppContext } from '../../lib/app-context';
import Link from 'next/link';
import { createBodyComposition } from './actions';
import NewMeasureSection from './new-measure-section';

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

function Sparkline({ values }: { values: number[] }) {
  const filtered = values.filter((v) => v !== null && Number.isFinite(v));
  if (filtered.length < 2) return <span className="text-xs text-gray-400">—</span>;
  const w = 90;
  const h = 24;
  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  const span = max - min || 1;
  const pts = filtered
    .map(
      (v, i) =>
        `${((i * (w - 4)) / (filtered.length - 1) + 2).toFixed(1)},${(
          h - 3 - ((v - min) / span) * (h - 6)
        ).toFixed(1)}`
    )
    .join(' ');
  return (
    <svg width={w} height={h}>
      <polyline points={pts} fill="none" stroke="#c8102e" strokeWidth="1.5" />
    </svg>
  );
}

const field = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm';
const label = 'block text-xs font-medium text-gray-500';

export default async function BodyCompositionPage() {
  const context = await requireAppContext();
  const players = await prisma.player.findMany({
    where: { teamId: context.teamId, deletedAt: null },
    orderBy: { playerId: 'asc' },
    include: {
      bodyCompositions: {
        where: {
          deletedAt: null,
          testSession: {
            teamId: context.teamId,
            seasonId: context.seasonId,
            deletedAt: null,
          },
        },
        orderBy: { createdAt: 'asc' },
        include: { testSession: { select: { DateTime: true, sessionId: true } } },
      },
    },
  });

  return (
    <div className="space-y-5 p-6">
      <NewMeasureSection>
        <form action={createBodyComposition} className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
            Дата *
            <input name="date" type="date" required className={field} />
          </label>
          <label className={label}>
            Масса, кг *
            <input name="mass" type="number" step="0.1" min="0" max="300" required className={field} />
          </label>
          <label className={label}>
            Жир, % *
            <input name="fat" type="number" step="0.1" min="0" max="60" required className={field} />
          </label>
          <label className={label}>
            БЖМ, кг *
            <input name="ffm" type="number" step="0.1" min="0" max="300" required className={field} />
          </label>
          <label className={label}>
            Фазовый угол, °
            <input name="phase" type="number" step="0.01" min="0" max="15" className={field} />
          </label>
          <label className={label}>
            Фаза сезона
            <select name="sessionPhase" className={field}>
              <option value="INSEASON">Сезон</option>
              <option value="PRESEASON">Предсезонка</option>
              <option value="CAMP">Сборы</option>
              <option value="POSTSEASON">Постсезон</option>
              <option value="RECOVERY">Восстановление</option>
            </select>
          </label>
          <div className="md:col-span-3">
            <button className="btn-primary">Сохранить замер</button>
          </div>
        </form>
      </NewMeasureSection>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">Игрок</th>
              <th className="px-4 py-2 text-right">Дата</th>
              <th className="px-4 py-2 text-right">Масса</th>
              <th className="px-4 py-2 text-right">% жира</th>
              <th className="px-4 py-2 text-right">БЖМ</th>
              <th className="px-4 py-2 text-right">Фазовый угол</th>
              <th className="px-4 py-2 text-left">Динамика % жира</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {players.map((p) => {
              const list = p.bodyCompositions;
              const b = list[list.length - 1];
              const first = list[0];
              const delta =
                b && first && b.fat_pct !== null && first.fat_pct !== null
                  ? +(b.fat_pct - first.fat_pct).toFixed(1)
                  : null;
              return (
                <tr key={p.id} className="relative">
                  <td className="px-4 py-3">
                    <Link
                      href={`/players/${p.id}`}
                      className="font-medium hover:underline after:absolute after:inset-0"
                    >
                      {p.lastName} {p.firstName}
                    </Link>
                    <div className="text-xs text-gray-400">{p.playerId}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {b ? fmtDate(b.testSession.DateTime) : <span className="text-gray-400">нет замеров</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">
                    {b && b.mass_kg !== null ? `${b.mass_kg.toFixed(1).replace('.', ',')} кг` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                    {b && b.fat_pct !== null ? `${b.fat_pct.toFixed(1).replace('.', ',')}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">
                    {b && b.ffm_kg !== null ? `${b.ffm_kg.toFixed(1).replace('.', ',')} кг` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">
                    {b && b.phase_angle !== null ? `${b.phase_angle.toFixed(2).replace('.', ',')}°` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Sparkline values={list.map((x) => x.fat_pct ?? 0)} />
                      {delta !== null && (
                        <span className="font-mono text-xs font-semibold text-gray-600">
                          {delta < 0 ? '↓' : delta > 0 ? '↑' : '→'} {Math.abs(delta).toFixed(1).replace('.', ',')} п.п.
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
