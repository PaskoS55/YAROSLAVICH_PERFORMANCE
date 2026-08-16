import { prisma } from '../../../lib/prisma';

function csvResponse(lines: string[], filename: string) {
  const csv = '\uFEFF' + lines.join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

const num = (v: number) => String(v).replace('.', ',');

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const id = searchParams.get('id');

  if (type === 'team') {
    const players = await prisma.player.findMany({
      where: { deletedAt: null },
      orderBy: { playerId: 'asc' },
      include: {
        testSessions: {
          where: { deletedAt: null },
          orderBy: { DateTime: 'desc' },
          include: { testResults: { where: { deletedAt: null } } },
        },
      },
    });
    const tests = await prisma.test.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
    });
    const lines: string[] = [];
    lines.push(['Игрок', 'ID', ...tests.map((t) => t.code)].join(';'));
    for (const p of players) {
      const latest = new Map<string, number>();
      for (const s of p.testSessions) {
        for (const r of s.testResults) {
          if (!latest.has(r.testId)) latest.set(r.testId, r.value);
        }
      }
      const cells = tests.map((t) => {
        const v = latest.get(t.id);
        return v === undefined ? '' : num(v);
      });
      lines.push(
        [`${p.lastName} ${p.firstName} ${p.middleName ?? ''}`.trim(), p.playerId, ...cells].join(
          ';'
        )
      );
    }
    return csvResponse(lines, 'team_summary.csv');
  }

  if (type === 'session' && id) {
    const session = await prisma.testSession.findUnique({
      where: { id },
      include: {
        player: true,
        testResults: { where: { deletedAt: null }, include: { test: true } },
      },
    });
    if (!session || session.deletedAt) return new Response('Not found', { status: 404 });
    const lines = [
      `Сессия;${session.sessionId}`,
      `Игрок;${session.player.lastName} ${session.player.firstName}`,
      `Дата;${new Date(session.DateTime).toLocaleDateString('ru-RU')}`,
      '',
      'Тест;Код;Результат;Ед.;QC',
      ...session.testResults.map((r) =>
        [r.test.name, r.test.code, num(r.value), r.test.unit, r.qcStatus].join(';')
      ),
    ];
    return csvResponse(lines, `session_${session.sessionId}.csv`);
  }

  if (type === 'player' && id) {
    const player = await prisma.player.findUnique({
      where: { id },
      include: {
        testSessions: {
          where: { deletedAt: null },
          orderBy: { DateTime: 'asc' },
          include: { testResults: { where: { deletedAt: null }, include: { test: true } } },
        },
      },
    });
    if (!player || player.deletedAt) return new Response('Not found', { status: 404 });
    const lines = [
      `Игрок;${player.lastName} ${player.firstName} ${player.middleName ?? ''}`,
      `ID;${player.playerId}`,
      '',
      'Дата;Сессия;Тест;Код;Результат;Ед.',
    ];
    for (const s of player.testSessions) {
      for (const r of s.testResults) {
        lines.push(
          [
            new Date(s.DateTime).toLocaleDateString('ru-RU'),
            s.sessionId,
            r.test.name,
            r.test.code,
            num(r.value),
            r.test.unit,
          ].join(';')
        );
      }
    }
    return csvResponse(lines, `player_${player.playerId}.csv`);
  }

  return new Response('Bad type', { status: 400 });
}