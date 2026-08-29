import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock('../../../lib/prisma', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('../../../lib/current-user', () => ({ requireCurrentUser: vi.fn(async () => ({ passwordHash: 'synthetic' })) }));
vi.mock('../../../lib/local-auth', () => ({ verifyPassword: vi.fn(async () => true) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { POST } from './route';
const empty = () => ({ brand: 'PASKO PERFORMANCE', product: 'PASKO PERFORMANCE PLATFORM', sportVertical: 'VOLLEYBALL', formatVersion: 4,
  ...Object.fromEntries(['organizations','teams','seasons','testCategories','players','tests','normProfiles','normEntries','referenceSources','normEntrySources','testSessions','testResults','bodyCompositions','playerGoals','equipment','qcFlags','importJobs','auditLogs','teamSeasonLinks'].map(key => [key,[]])) });
beforeEach(() => { vi.clearAllMocks(); });
it.each([
  ['null root', null],
  ['null row', { ...empty(), players: [null] }],
  ['primitive row', { ...empty(), teams: [42] }],
  ['wrong product', { ...empty(), product: 'UNRELATED' }],
  ['wrong sport', { ...empty(), sportVertical: 'OTHER' }],
])('rejects %s with a safe 400 before any transaction', async (_, data) => {
  const response = await POST(new Request('http://127.0.0.1/api/restore', {
    method: 'POST', headers: { 'X-Restore-Confirm': 'RESTORE', 'X-Restore-Password': 'synthetic-test' }, body: JSON.stringify(data),
  }));
  expect(response.status).toBe(400);
  expect(mocks.transaction).not.toHaveBeenCalled();
});
