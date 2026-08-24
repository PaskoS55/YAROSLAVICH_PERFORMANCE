import { requireCurrentUser } from '../../../lib/current-user';
import { collectDiagnostics, collectRedactedLogs } from '../../../lib/diagnostics';
import { createSupportZip } from '../../../lib/support-bundle';

export const dynamic = 'force-dynamic';
export async function GET() {
  await requireCurrentUser();
  const diagnostics = await collectDiagnostics();
  const safeDiagnostics = { ...diagnostics, installationId: diagnostics.installationId ? `${diagnostics.installationId.slice(0, 8)}…` : null };
  const bundle = createSupportZip([
    { name: 'diagnostics.json', content: JSON.stringify(safeDiagnostics, null, 2) },
    { name: 'runtime.log', content: await collectRedactedLogs() },
  ]);
  return new Response(new Uint8Array(bundle), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="pasko-support-${new Date().toISOString().slice(0, 10)}.zip"`, 'Cache-Control': 'no-store' } });
}
