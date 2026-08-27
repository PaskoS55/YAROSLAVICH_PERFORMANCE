import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as enterDemo } from './demo-enter/route';
import { GET as logoutGet, POST as logoutPost } from './auth/logout/route';
import { requireCurrentUser } from '../../lib/current-user';
import { operationalLicenseRequired } from '../../lib/license-policy';
import { productionWorkspaceRequired } from '../../lib/workspace';

vi.mock('../../lib/current-user', () => ({ requireCurrentUser: vi.fn(async () => ({ id: 'test-admin' })) }));
vi.mock('../../lib/license-policy', () => ({ operationalLicenseRequired: vi.fn() }));
vi.mock('../../lib/workspace', () => ({ DEMO_CAPABILITY_COOKIE: 'pasko_demo_capability', productionWorkspaceRequired: vi.fn() }));
vi.mock('../../lib/session', () => ({ createDemoCapability: vi.fn(async () => 'synthetic-capability') }));
beforeEach(() => { vi.clearAllMocks(); });
describe('document navigation endpoints', () => {
  it('Demo authorizes the current user and returns a host-relative uncached redirect', async () => {
    const response = await enterDemo();
    expect(requireCurrentUser).toHaveBeenCalledOnce();
    expect(operationalLicenseRequired).toHaveBeenCalledOnce();
    expect(productionWorkspaceRequired).toHaveBeenCalledOnce();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('/demo-workspace');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.cookies.get('pasko_demo_capability')).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/' });
  });
  it.each([['GET', logoutGet], ['POST', logoutPost]] as const)('%s logout clears auth and demo cookies without changing origin', async (_, handler) => {
    const response = await handler();
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/login');
    expect(response.headers.get('cache-control')).toBe('no-store');
    for (const name of ['yp_auth', 'pasko_demo_capability']) expect(response.cookies.get(name)).toMatchObject({ value: '', path: '/', expires: new Date(0) });
  });
  it('does not mint Demo capability if the current session is rejected', async () => {
    vi.mocked(requireCurrentUser).mockRejectedValueOnce(new Error('NO_SESSION'));
    await expect(enterDemo()).rejects.toThrow('NO_SESSION');
  });
});
