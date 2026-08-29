import Link from 'next/link';
import RadarChart from './RadarChart';
import type { buildProfileModel } from '../lib/profile-model';

export default function PlayerProfilePanel({ model, referenceConfirmed, referenceProfile }: {
  model: ReturnType<typeof buildProfileModel>;
  referenceConfirmed: boolean;
  referenceProfile: { id: string; name: string; version: string } | null;
}) {
  const { coverage, numericCategories, values, teamValues } = model;
  return (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-2 text-xl font-bold">Профиль игрока</h2>
          {!referenceConfirmed && <p className="mb-2 text-sm text-amber-700">Для стандартизированного профиля подтвердите соответствие команды полу, возрасту и уровню выбранного референса в <Link href="/norms" className="underline">«Референсы и нормативы»</Link>. Для возрастных референсов также нужна дата рождения игрока.</p>}
          {numericCategories.length >= 3 ? (
            <RadarChart
              categories={numericCategories.map((c) => ({ id: c.id, name: c.name, missingLabel: c.coverage.reason, description: c.coverage.used.map(m => `${m.name}: ${m.score!.description} — ${m.score!.raw.toFixed(2)}`).join('; ') || c.coverage.reason }))}
              values={values}
              teamValues={teamValues}
              playerLabel="Игрок"
            />
          ) : (
            <p className="text-sm text-gray-500">
              Для радара нужны минимум три категории с совместимыми числовыми референсами. Доступные оценки и причины приведены ниже.
            </p>
          )}
          <ul className="mt-3 space-y-2 text-sm" aria-label="Покрытие числовой оценки">
            {numericCategories.map(c => <li key={c.id}>
              <b>{c.name} — {c.coverage.used.length}/{c.coverage.total}</b>
              <div>{c.coverage.score === null ? c.coverage.reason : `${Math.round(c.coverage.score)} баллов. Использованы: ${c.coverage.used.map(m => m.name).join(', ')}`}</div>
              <div className="text-xs text-gray-500">Совместимые числовые референсы: {c.coverage.supported}/{c.coverage.total}.</div>
              {c.coverage.metrics.filter(m => !m.score).map(m => <div key={m.id} className="text-xs text-gray-500">{m.name}: {m.reason}</div>)}
            </li>)}
          </ul>
          {coverage.some(c => c.coverage.supported === 0) && <section className="mt-4 rounded border p-3">
            <h3 className="font-semibold">Недоступно для числовой оценки</h3>
            <ul className="mt-2 space-y-2 text-sm">{coverage.filter(c => c.coverage.supported === 0).map(c => <li key={c.id}>{c.name} — {c.coverage.reason}</li>)}</ul>
          </section>}
          <p className="mt-2 text-xs text-gray-500">
            Стандартизированный профиль: 50 — среднее референсной группы, 60 — +1 SD, 40 — −1 SD в направлении лучшей производительности. Эмпирический перцентиль рассчитывается отдельно только для записей соответствующего типа. Категория — среднее доступных баллов; типы указаны в подсказках. График ограничен 0–100, исходные баллы не обрезаются.
          </p>
          {referenceProfile && <Link href={`/norms?profile=${referenceProfile.id}`} className="text-xs underline">{referenceProfile.name} · v{referenceProfile.version} · источники и протоколы</Link>}
        </div>
  );
}
