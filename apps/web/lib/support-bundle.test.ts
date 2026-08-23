import { describe, expect, it } from 'vitest';
import { createSupportZip, redactSupportText, supportBundleDigest } from './support-bundle';

describe('support bundle privacy', () => {
  it('redacts credentials, headers, cookies and recovery secrets', () => {
    const source = 'postgresql://user:db-secret@127.0.0.1/db Authorization: Bearer auth-token Cookie: yp_auth=session password=plain recoveryKey:key installationSecret:machine';
    const result = redactSupportText(source);
    for (const secret of ['db-secret', 'auth-token', 'yp_auth=session', 'password=plain', 'recoveryKey:key', 'installationSecret:machine']) expect(result).not.toContain(secret);
  });

  it('creates a local ZIP without database dumps or player private data', () => {
    const bundle = createSupportZip([
      { name: 'diagnostics.json', content: JSON.stringify({ players: 12, databaseStatus: 'HEALTHY' }) },
      { name: 'runtime.log', content: 'password=hidden' },
    ]);
    const text = bundle.toString('utf8');
    expect(bundle.readUInt32LE(0)).toBe(0x04034b50);
    expect(text).toContain('diagnostics.json');
    expect(text).toContain('[REDACTED]');
    expect(text).not.toContain('hidden');
    expect(text).not.toContain('.dump');
    expect(text).not.toContain('playerName');
    expect(supportBundleDigest(bundle)).toMatch(/^[0-9a-f]{64}$/);
  });
});
