import type { NormProfile } from '@prisma/client';
import type { ReferenceEntryWithTest } from './references';
import { scoreProfileMetric, type ProfileMetric } from './player-profile';

type Definition = Pick<ProfileMetric, 'code' | 'name' | 'unit' | 'direction' | 'categoryId'> & { id: string };
type Profile = Pick<NormProfile, 'id' | 'version' | 'sport' | 'sex' | 'ageGroup' | 'level'>;
const numeric = (entry: ReferenceEntryWithTest) => ['EMPIRICAL_PERCENTILE', 'PUBLISHED_DISTRIBUTION'].includes(entry.interpretationType);

// Coverage is independent of whether a player has recorded a result. Only real
// results enter scoring; the neutral probe below checks reference compatibility.
export function profileCategoryCoverage(tests: Definition[], entries: ReferenceEntryWithTest[], profile: Profile | null,
  player: { position: string; birthDate: Date | null }, confirmed: boolean, latest: ReadonlyMap<string, ProfileMetric>, now: Date) {
  const metrics = tests.map(test => {
    const candidates = entries.filter(e => e.testId === test.id);
    const entry = candidates.filter(e => e.position === player.position).at(-1) ?? candidates.filter(e => e.position === null).at(-1) ?? null;
    const result = latest.get(test.id);
    const base = { id: test.id, name: test.name, score: null, supported: false };
    if (!profile) return { ...base, reason: 'Не выбран доступный референсный профиль', incompatible: true };
    if (!entry || !numeric(entry)) {
      if (candidates.some(numeric)) return { ...base, reason: 'Нет совместимого числового референса для амплуа игрока', incompatible: true };
      return { ...base, reason: entry?.interpretationType === 'CONTEXT_ONLY'
        ? 'Контекстная оценка; числовой референс не утверждён' : 'Нет утверждённого числового референса', incompatible: false };
    }
    let reason: string | null = null;
    if (!confirmed) reason = 'Не подтверждено соответствие команды полу, возрасту и уровню референса';
    else if (entry.profileId !== profile.id || entry.test.code !== test.code || entry.test.unit !== test.unit) reason = 'Несовместимые профиль, код метрики или единица измерения';
    else if (entry.interpretationType === 'PUBLISHED_DISTRIBUTION') {
      if (profile.sport !== 'VOLLEYBALL') reason = 'Несовместимый вид спорта';
      else if (!['HIGHER_IS_BETTER', 'LOWER_IS_BETTER'].includes(test.direction)) reason = 'Направление метрики не поддерживает числовую оценку';
      else if (!profile.version || (!entry.sourceText?.trim() && !entry.sources.length)) reason = 'Не указаны версия или происхождение референса';
      else if (entry.mean === null || !Number.isFinite(entry.mean) || entry.sd === null || !Number.isFinite(entry.sd) || entry.sd <= 0) reason = 'Некорректные среднее или SD референса';
      else if (profile.ageGroup !== 'UNSPECIFIED') {
        const measuredAt = result?.measuredAt ?? now;
        if (!player.birthDate || !Number.isFinite(player.birthDate.getTime())) reason = 'Для возрастного референса нужна дата рождения игрока';
        else {
          const adultAt = new Date(player.birthDate); adultAt.setUTCFullYear(adultAt.getUTCFullYear() + 18);
          if (player.birthDate > measuredAt || (profile.ageGroup === 'ADULT') !== (measuredAt >= adultAt)) reason = 'Возраст игрока на дату результата не соответствует референсу';
        }
      }
    }
    const probe = { ...test, testId: test.id, value: entry.mean ?? 0, measuredAt: result?.measuredAt ?? now };
    if (!reason && !scoreProfileMetric(probe, entry, profile, player, confirmed)) reason = 'Числовые параметры референса не поддерживают расчёт';
    if (reason) return { ...base, reason, incompatible: true };
    const score = result ? scoreProfileMetric(result, entry, profile, player, confirmed) : null;
    return { ...base, supported: true, score, incompatible: !!result && !score,
      reason: score ? null : result ? 'Результат несовместим с референсом' : 'Нет результата' };
  });
  const used = metrics.filter(m => m.score !== null);
  const supported = metrics.filter(m => m.supported).length;
  const state = used.length ? 'NUMERIC' : metrics.some(m => m.incompatible) ? 'INCOMPATIBLE' : supported ? 'MISSING' : 'UNSUPPORTED';
  return { metrics, total: tests.length, supported, used, state,
    score: used.length ? used.reduce((sum, m) => sum + m.score!.raw, 0) / used.length : null,
    reason: state === 'UNSUPPORTED'
      ? metrics.length && metrics.every(m => m.reason?.startsWith('Контекстная'))
        ? 'Контекстная оценка; числовой референс не утверждён' : 'Нет утверждённого числового референса'
      : state === 'MISSING' ? 'Нет результата' : metrics.filter(m => m.incompatible).map(m => `${m.name}: ${m.reason}`).join('; ') };
}
