import { describe, expect, it } from 'vitest';
import { signContextSelection, verifyContextSelection } from './context-cookie';

const secret = 'unit-test-context-secret-at-least-32-characters';
const selection = { organizationId: 'org-a', teamId: 'team-a', seasonId: 'season-a' };

describe('signed context cookie', () => {
  it('accepts an intact signed selection', async () => {
    const token = await signContextSelection(selection, secret);
    await expect(verifyContextSelection(token, secret)).resolves.toEqual(selection);
  });

  it('rejects modified payload, signature, and wrong domain secret', async () => {
    const token = await signContextSelection(selection, secret);
    const [payload, signature] = token.split('.');
    await expect(verifyContextSelection(`${payload}x.${signature}`, secret)).resolves.toBeNull();
    await expect(verifyContextSelection(`${payload}.${signature}x`, secret)).resolves.toBeNull();
    await expect(verifyContextSelection(token, `${secret}-other`)).resolves.toBeNull();
  });
});
