import { prisma } from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tests = await prisma.test.findMany({
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
  });

  const sample = (qcMin: number | null, qcMax: number | null) => {
    if (qcMin !== null && qcMax !== null) return +(((qcMin + qcMax) / 2)).toFixed(2);
    if (qcMin !== null) return +(qcMin * 1.2).toFixed(2);
    if (qcMax !== null) return +(qcMax * 0.8).toFixed(2);
    return 0;
  };

  const lines = [
    'PlayerID;Date;TestCode;Value;Phase',
    ...tests.map(
      (t) => `P001;2026-08-11;${t.code};${sample(t.qcMin, t.qcMax)};INSEASON`
    ),
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="import-template.csv"',
    },
  });
}