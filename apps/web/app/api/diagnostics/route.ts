import { NextResponse } from 'next/server';
import { requireCurrentUser } from '../../../lib/current-user';
import { collectDiagnostics } from '../../../lib/diagnostics';

export const dynamic = 'force-dynamic';
export async function GET() {
  await requireCurrentUser();
  return NextResponse.json(await collectDiagnostics());
}
