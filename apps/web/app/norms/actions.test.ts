import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  context: { organizationId: 'org-current', organizationName: 'Current Club', teamId: 'team-current' },
  profileFindFirst: vi.fn(),
  teamUpdate: vi.fn(),
  entryFindFirst: vi.fn(),
  entryUpdate: vi.fn(),
  profileCreate: vi.fn(),
  entryCreate: vi.fn(),
  entrySourceCreateMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../lib/current-user', () => ({ requireCurrentUser: vi.fn(async () => ({ id: 'admin' })) }));
vi.mock('../../lib/app-context', () => ({ requireAppContext: vi.fn(async () => mocks.context) }));
vi.mock('../../lib/prisma', () => ({
  prisma: {
    normProfile: { findFirst: mocks.profileFindFirst },
    team: { update: mocks.teamUpdate },
    normEntry: { findFirst: mocks.entryFindFirst, update: mocks.entryUpdate },
    $transaction: vi.fn(async (callback) => callback({
      normProfile: { create: mocks.profileCreate },
      normEntry: { create: mocks.entryCreate },
      normEntrySource: { createMany: mocks.entrySourceCreateMany },
      team: { update: mocks.teamUpdate },
      auditLog: { create: mocks.auditCreate },
    })),
  },
}));

import * as actions from './actions';

const legacyEntry = {
  id: 'legacy-entry', profileId: 'legacy-profile', testId: 'test-1', position: 'setter',
  interpretationType: 'EMPIRICAL_PERCENTILE', evidenceLevel: 'NOT_APPLICABLE',
  mean: null, sd: null, ciLow: null, ciHigh: null, referenceLow: null, referenceHigh: null,
  p10: 10, p25: 25, p50: 50, p75: 75, p90: 90, sampleSize: 42,
  evidenceScope: 'legacy cohort', sourceText: 'Legacy internal source', protocolText: 'Protocol',
  measurementMethod: 'Method', validFrom: new Date('2020-01-01'), validUntil: new Date('2025-01-01'),
  notes: 'Imported unchanged', derivedByPasko: false, deletedAt: null,
  createdAt: new Date('2020-01-01'), updatedAt: new Date('2020-01-02'),
  sources: [{ entryId: 'legacy-entry', sourceId: 'legacy-source', role: 'PRIMARY' }],
};

const legacyProfile = {
  id: 'legacy-profile', code: 'LEGACY_IMPORTED', name: 'Импортированные нормативы предыдущей версии',
  sport: 'VOLLEYBALL', sex: 'MALE', level: 'ELITE', ageGroup: 'ADULT',
  version: 'legacy', scope: 'INSTALLATION_LEGACY', entries: [legacyEntry],
};

describe('reference profile server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profileCreate.mockResolvedValue({ id: 'clone-profile' });
    mocks.entryCreate.mockResolvedValue({ id: 'clone-entry' });
  });

  it('clones installation legacy into the organization from server AppContext and preserves metadata', async () => {
    mocks.profileFindFirst.mockResolvedValue(legacyProfile);
    const form = new FormData();
    form.set('profileId', legacyProfile.id);
    form.set('name', 'Current Club Legacy Clone');
    form.set('organizationId', 'org-forged');

    await expect(actions.cloneReferenceProfile(null, form)).resolves.toEqual({ ok: true, profileId: 'clone-profile' });
    const profileData = mocks.profileCreate.mock.calls[0][0].data;
    expect(profileData).toMatchObject({ scope: 'ORGANIZATION', organizationId: 'org-current', baseProfileId: 'legacy-profile' });
    expect(profileData.code).toMatch(/^ORG_org-current_[0-9a-f-]{36}$/);

    const copied = mocks.entryCreate.mock.calls[0][0].data;
    expect(copied).toMatchObject({
      profileId: 'clone-profile', testId: 'test-1', position: 'setter',
      interpretationType: 'EMPIRICAL_PERCENTILE', p10: 10, p25: 25, p50: 50, p75: 75, p90: 90,
      sourceText: 'Legacy internal source', validFrom: legacyEntry.validFrom, validUntil: legacyEntry.validUntil,
      notes: 'Imported unchanged', evidenceScope: 'legacy cohort', protocolText: 'Protocol', measurementMethod: 'Method',
    });
    expect(mocks.entrySourceCreateMany).toHaveBeenCalledWith({ data: [{ entryId: 'clone-entry', sourceId: 'legacy-source', role: 'PRIMARY' }] });
    copied.notes = 'Edited clone';
    expect(legacyEntry.notes).toBe('Imported unchanged');
  });

  it('does not trust a forged target organization and cannot clone into another organization', async () => {
    mocks.profileFindFirst.mockResolvedValue(legacyProfile);
    const form = new FormData();
    form.set('profileId', legacyProfile.id);
    form.set('name', 'Forged Target');
    form.set('organizationId', 'org-other');
    await actions.cloneReferenceProfile(null, form);
    expect(mocks.profileCreate.mock.calls[0][0].data.organizationId).toBe('org-current');
  });

  it('rejects direct assignment of an installation legacy profile', async () => {
    mocks.profileFindFirst.mockResolvedValue(null);
    const form = new FormData();
    form.set('profileId', legacyProfile.id);
    expect(await actions.assignReferenceProfile(null, form)).toEqual({ error: 'Профиль недоступен для текущей организации.' });
    expect(mocks.teamUpdate).not.toHaveBeenCalled();
  });

  it('rejects direct editing of installation legacy entries', async () => {
    mocks.entryFindFirst.mockResolvedValue(null);
    const form = new FormData();
    form.set('entryId', legacyEntry.id);
    expect(await actions.updateReferenceEntry(null, form)).toEqual({ error: 'Системные и чужие референсы нельзя изменять.' });
    expect(mocks.entryUpdate).not.toHaveBeenCalled();
  });

  it('exposes no delete action for reference profiles', () => {
    expect(actions).not.toHaveProperty('deleteReferenceProfile');
    expect(actions).not.toHaveProperty('deleteReferenceEntry');
  });

  it('requires compatibility confirmation and records only the server-selected team/profile metadata', async () => {
    const profile = { ...legacyProfile, id: 'system', scope: 'SYSTEM' };
    mocks.profileFindFirst.mockResolvedValue(profile);
    const form = new FormData(); form.set('profileId', 'system'); form.set('teamId', 'forged'); form.set('sex', 'FEMALE');
    expect(await actions.assignReferenceProfile(null, form)).toHaveProperty('error');
    expect(mocks.teamUpdate).not.toHaveBeenCalled();
    form.set('compatibilityConfirmed', 'yes');
    expect(await actions.assignReferenceProfile(null, form)).toMatchObject({ ok: true });
    expect(mocks.teamUpdate).toHaveBeenCalledWith({ where: { id: 'team-current' }, data: { activeNormProfileId: 'system' } });
    expect(mocks.auditCreate.mock.calls[0][0].data).toMatchObject({ entityId: 'team-current', newValues: { profileId: 'system', version: 'legacy', sex: 'MALE' } });
  });
});
