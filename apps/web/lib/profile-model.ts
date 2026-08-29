import type { Test, TestCategory } from '@prisma/client';
import { latestMeasurements, type MeasurementSession } from './measurements';
import { profileCategoryCoverage } from './profile-coverage';
import { profileHighlights } from './player-profile';

type Category = Pick<TestCategory, 'id' | 'name'> & { tests: Test[] };
type Player = { position: string; birthDate: Date | null; testSessions: MeasurementSession[] };
type Profile = Parameters<typeof profileCategoryCoverage>[2];
type Entries = Parameters<typeof profileCategoryCoverage>[1];

export function buildProfileModel(categories: Category[], entries: Entries, profile: Profile,
  player: Player, confirmed: boolean, cutoff: Date, teammates: Player[] = []) {
  const latest = latestMeasurements(player.testSessions, cutoff);
  const coverage = categories.map(c => ({ ...c,
    coverage: profileCategoryCoverage(c.tests, entries, profile, player, confirmed, latest, cutoff) }));
  const numericCategories = coverage.filter(c => c.coverage.supported > 0);
  const teammateLatest = teammates.map(p => ({ player: p, latest: latestMeasurements(p.testSessions, cutoff) }));
  const teamValues = numericCategories.map(c => {
    const scores = teammateLatest.map(p => profileCategoryCoverage(c.tests, entries, profile, p.player, confirmed, p.latest, cutoff).score)
      .filter((score): score is number => score !== null);
    return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  });
  const cats = coverage.filter(c => c.coverage.score !== null).map(c => ({ key: c.id, label: c.name, score: c.coverage.score! }));
  return { coverage, numericCategories, teamValues, cats, ...profileHighlights(cats),
    values: numericCategories.map(c => c.coverage.score === null ? null : Math.round(c.coverage.score)) };
}
