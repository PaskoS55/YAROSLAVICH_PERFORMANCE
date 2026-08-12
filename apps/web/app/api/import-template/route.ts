export async function GET() {
  const template = `PlayerID;Date;TestCode;Value
P001;2026-08-11;PWR_CMJ;48.2
P002;2026-08-11;PWR_CMJ;45.1
P003;2026-08-11;SPD_10;1.71`;

  return new Response(template, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="import-template.csv"',
    },
  });
}