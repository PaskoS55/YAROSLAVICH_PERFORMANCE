import { describe, expect, it, vi } from 'vitest';
import { resolveAppContext } from './app-context-core';

const org = { id: 'org-a', name: 'Club A', shortName: 'A', logoAssetKey: null, primaryColor: null, secondaryColor: null };
const team = { id: 'team-a', name: 'Team A', code: 'MAIN', organizationId: 'org-a' };
const season = { id: 'season-a', name: '2026/27', startDate: new Date('2026-07-01'), endDate: new Date('2027-06-30') };

function db(overrides: Record<string, unknown> = {}): any {
  return {
    organization: { findMany: vi.fn(async () => [org]), findFirst: vi.fn(async () => org) },
    team: { findMany: vi.fn(async () => [team]), findFirst: vi.fn(async () => team) },
    season: { findMany: vi.fn(async () => [season]), findFirst: vi.fn(async () => season) },
    ...overrides,
  };
}

describe('AppContext resolution', () => {
  it('uses deterministic 1x1x1 fallback', async () => {
    await expect(resolveAppContext(db(), null)).resolves.toMatchObject({ status: 'READY', organizationId: 'org-a', teamId: 'team-a', seasonId: 'season-a' });
  });

  it('returns typed empty setup states', async () => {
    await expect(resolveAppContext(db({ organization: { findMany: vi.fn(async () => []), findFirst: vi.fn() } }), null)).resolves.toEqual({ status: 'NO_ORGANIZATION' });
    await expect(resolveAppContext(db({ team: { findMany: vi.fn(async () => []), findFirst: vi.fn() } }), null)).resolves.toEqual({ status: 'NO_TEAM' });
    await expect(resolveAppContext(db({ season: { findMany: vi.fn(async () => []), findFirst: vi.fn() } }), null)).resolves.toEqual({ status: 'NO_SEASON' });
  });

  it('requires explicit selection for multiple organizations, teams, or seasons', async () => {
    await expect(resolveAppContext(db({ organization: { findMany: vi.fn(async () => [org, { ...org, id: 'org-b' }]), findFirst: vi.fn() } }), null)).resolves.toEqual({ status: 'SELECTION_REQUIRED', level: 'ORGANIZATION' });
    await expect(resolveAppContext(db({ team: { findMany: vi.fn(async () => [team, { ...team, id: 'team-b' }]), findFirst: vi.fn() } }), null)).resolves.toEqual({ status: 'SELECTION_REQUIRED', level: 'TEAM' });
    await expect(resolveAppContext(db({ season: { findMany: vi.fn(async () => [season, { ...season, id: 'season-b' }]), findFirst: vi.fn() } }), null)).resolves.toEqual({ status: 'SELECTION_REQUIRED', level: 'SEASON' });
  });

  it('rejects deleted or unrelated selection links without fallback', async () => {
    const selection = { organizationId: 'org-a', teamId: 'team-a', seasonId: 'season-a' };
    await expect(resolveAppContext(db({ organization: { findMany: vi.fn(), findFirst: vi.fn(async () => null) } }), selection)).resolves.toEqual({ status: 'INVALID_CONTEXT', level: 'ORGANIZATION' });
    await expect(resolveAppContext(db({ team: { findMany: vi.fn(), findFirst: vi.fn(async () => null) } }), selection)).resolves.toEqual({ status: 'INVALID_CONTEXT', level: 'TEAM' });
    await expect(resolveAppContext(db({ season: { findMany: vi.fn(), findFirst: vi.fn(async () => null) } }), selection)).resolves.toEqual({ status: 'INVALID_CONTEXT', level: 'SEASON' });
  });

  it('binds explicit team and season lookups to their parent context', async () => {
    const mockDb = db();
    await resolveAppContext(mockDb, { organizationId: 'org-a', teamId: 'team-a', seasonId: 'season-a' });
    expect(mockDb.team.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'team-a', organizationId: 'org-a', deletedAt: null },
    }));
    expect(mockDb.season.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'season-a', deletedAt: null, teams: { some: { id: 'team-a' } } },
    }));
  });
});
