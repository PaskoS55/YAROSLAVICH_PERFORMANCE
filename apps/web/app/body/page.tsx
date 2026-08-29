import { prisma } from '../../lib/prisma';
import { requireAppContext } from '../../lib/app-context';
import Link from 'next/link';
import { createBodyComposition } from './actions';
import { BODY_METRICS, bodyMetricConflict, type BodyMetricCode } from '../../lib/body-metrics';
import { latestMeasurements, historicalSessions } from '../../lib/measurements';
import { resolveBodyConflict } from './conflict-actions';
import NewMeasureSection from './new-measure-section';
import { fmtVal } from '../../lib/analytics';

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

export default async function BodyCompositionPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const query = await searchParams;
  const context = await requireAppContext();
  const now = new Date();
  const players = await prisma.player.findMany({
    where: { teamId: context.teamId, deletedAt: null },
    orderBy: { playerId: 'asc' },
    include: {
      testSessions: {
        where: { teamId: context.teamId, seasonId: context.seasonId, deletedAt: null, DateTime: { lte: now } },
        include: { testResults: { where: { deletedAt: null, qcStatus: 'PASSED', test: { code: { in: Object.keys(BODY_METRICS) } } }, include: { test: true } } },
      },
      bodyCompositions: {
        where: {
          deletedAt: null,
          testSession: {
            teamId: context.teamId,
            seasonId: context.seasonId,
            deletedAt: null,
          },
        },
        orderBy: [{ testSession: { DateTime: 'asc' } }, { createdAt: 'asc' }, { id: 'asc' }],
        include: { testSession: { include: { testResults: { include: { test: true } } } } },
      },
    },
  });

  const conflicts = players.flatMap(player => player.bodyCompositions.flatMap(snapshot =>
    (Object.keys(BODY_METRICS) as BodyMetricCode[]).flatMap(code => {
      const result = snapshot.testSession.testResults.find(result => result.test.code === code) ?? null;
      return bodyMetricConflict(snapshot, code, result) ? [{ player, snapshot, code, result }] : [];
    })));

  return (
    <div className="space-y-5 p-6">
      {query.error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{query.error === 'invalid' ? 'Проверьте игрока, дату и значения: масса 0–300 кг, жир 0–60%, БЖМ не больше массы, фазовый угол 0–15°.' : query.error === 'conflict' ? 'Сначала разрешите существующие расхождения ниже. Данные не изменены.' : query.error === 'ambiguous' ? 'За выбранный день найдено несколько сессий этой фазы. Измените нужную сессию в «Истории»; автоматическое сопоставление небезопасно.' : query.error === 'resolution' ? 'Не удалось разрешить конфликт: запись могла измениться или недоступна. Обновите страницу и проверьте значения.' : 'Не удалось сохранить замер. Данные не изменены; повторите попытку.'}</p>}
      {query.saved === '1' && <p role="status" className="rounded border border-green-200 bg-green-50 p-3 text-sm">Замер сохранён.</p>}
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

      <p className="text-sm text-gray-500">Последние подтверждённые исторические результаты BC-метрик. Дата каждой метрики указана в подсказке. БЖМ вводится как измеренное значение, не вычисляется из массы и процента жира.</p>
      {conflicts.length > 0 && <section aria-label="Расхождения состава тела" className="space-y-3 rounded border border-amber-300 bg-amber-50 p-4">
        <h2 className="text-xl font-bold">Расхождения состава тела</h2>
        <p className="text-sm">Оба исходных значения сохранены. В таблице и аналитике используются результаты тестов. Выберите значение для каждой записи явно; другие снимки не перезаписываются.</p>
        {conflicts.map(({ player, snapshot, code, result }) => <form key={snapshot.id + code} action={resolveBodyConflict} className="rounded border bg-white p-3" data-body-conflict={code}>
          <b>{player.lastName} {player.firstName} · {snapshot.testSession.DateTime.toLocaleString('ru-RU')} · {BODY_METRICS[code].name}</b>
          <p>Состав тела: {snapshot[BODY_METRICS[code].field]} {BODY_METRICS[code].unit} · Результат теста: {result && !result.deletedAt ? result.value : 'нет активного результата'} {BODY_METRICS[code].unit}</p>
          <input type="hidden" name="snapshot" value={snapshot.id} />
          <input type="hidden" name="metric" value={code} />
          <input type="hidden" name="snapshotVersion" value={snapshot.updatedAt.toISOString()} />
          <input type="hidden" name="resultVersion" value={result?.updatedAt.toISOString() ?? ''} />
          <div className="mt-2 flex flex-wrap gap-2">
            <button name="choice" value="test" className="btn-secondary" disabled={!result || !!result.deletedAt}>Использовать значение из результата теста</button>
            <button name="choice" value="body" className="btn-secondary">Использовать значение из состава тела</button>
          </div>
        </form>)}
      </section>}

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
              const latest = latestMeasurements(p.testSessions, now);
              const metrics = new Map([...latest.values()].map(metric => [metric.code, metric]));
              const mass = metrics.get('BC_MASS');
              const fat = metrics.get('BC_FAT');
              const ffm = metrics.get('BC_FFM');
              const list = historicalSessions(p.testSessions, now).reverse().flatMap(session => session.testResults.filter(result => result.test.code === 'BC_FAT').map(result => result.value));
              const b = p.bodyCompositions.filter(snapshot => snapshot.testSession.DateTime <= now).at(-1);
              const lastDate = [...metrics.values()].sort((a,b) => b.measuredAt.getTime()-a.measuredAt.getTime())[0]?.measuredAt;
              const delta = list.length > 1 ? +(list[list.length-1]-list[0]).toFixed(2) : null;
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
                    {lastDate ? fmtDate(lastDate) : <span className="text-gray-400">нет замеров</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">
                    <span title={fmtDate(mass?.measuredAt)}>{mass ? `${fmtVal(mass.value)} кг` : '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                    <span title={fmtDate(fat?.measuredAt)}>{fat ? `${fmtVal(fat.value)}%` : '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">
                    <span title={fmtDate(ffm?.measuredAt)}>{ffm ? `${fmtVal(ffm.value)} кг` : '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">
                    {b && b.phase_angle !== null ? `${b.phase_angle.toFixed(2).replace('.', ',')}°` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Sparkline values={list} />
                      {delta !== null && (
                        <span className="font-mono text-xs font-semibold text-gray-600">
                          {delta < 0 ? '↓' : delta > 0 ? '↑' : '→'} {fmtVal(Math.abs(delta))} п.п.
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
