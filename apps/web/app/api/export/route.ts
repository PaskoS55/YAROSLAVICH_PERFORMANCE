import { prisma } from '../../../lib/prisma';
import { requireAppContext } from '../../../lib/app-context';
import { csvRow, csvAttachment } from '../../../lib/csv';

function csvResponse(lines: string[], filename: string) {
  const csv = '\uFEFF' + lines.join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': csvAttachment(filename),
    },
  });
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const context = await requireAppContext();
  const now = new Date();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const id = searchParams.get('id');

  if (type === 'team') {
    const players = await prisma.player.findMany({
      where: { teamId: context.teamId, deletedAt: null },
      orderBy: { playerId: 'asc' },
      include: {
        testSessions: {
          where: { teamId: context.teamId, seasonId: context.seasonId, deletedAt: null, DateTime: { lte: now } },
          orderBy: [{ DateTime: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          include: { testResults: { where: { deletedAt: null, qcStatus: 'PASSED' } } },
        },
      },
    });
    const tests = await prisma.test.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
    });
    const lines: string[] = [];
    lines.push(csvRow(['Игрок', 'ID', ...tests.map((t) => t.code)]));
    for (const p of players) {
      const latest = new Map<string, number>();
      for (const s of p.testSessions) {
        for (const r of s.testResults) {
          if (!latest.has(r.testId)) latest.set(r.testId, r.value);
        }
      }
      const cells = tests.map((t) => {
        const v = latest.get(t.id);
        return v === undefined ? '' : v;
      });
      lines.push(
        csvRow([`${p.lastName} ${p.firstName} ${p.middleName ?? ''}`.trim(), p.playerId, ...cells])
      );
    }
    return csvResponse(lines, 'team_summary.csv');
  }

  if (type === 'session' && id) {
    const session = await prisma.testSession.findFirst({
      where: { id, teamId: context.teamId, seasonId: context.seasonId, deletedAt: null },
      include: {
        player: true,
        testResults: { where: { deletedAt: null }, include: { test: true } },
      },
    });
    if (!session) return new Response('Not found', { status: 404 });
    const lines = [
      csvRow(['Сессия', session.sessionId]),
      csvRow(['Игрок', `${session.player.lastName} ${session.player.firstName}`]),
      csvRow(['Дата', new Date(session.DateTime).toLocaleDateString('ru-RU')]),
      '',
      'Тест;Код;Результат;Ед.;QC',
      ...session.testResults.map((r) =>
        csvRow([r.test.name, r.test.code, r.value, r.test.unit, r.qcStatus])
      ),
    ];
    return csvResponse(lines, `session_${session.sessionId}.csv`);
  }

  if (type === 'player' && id) {
    const player = await prisma.player.findFirst({
      where: { id, teamId: context.teamId, deletedAt: null },
      include: {
        testSessions: {
          where: { teamId: context.teamId, seasonId: context.seasonId, deletedAt: null, DateTime: { lte: now } },
          orderBy: [{ DateTime: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          include: { testResults: { where: { deletedAt: null, qcStatus: 'PASSED' }, include: { test: true } } },
        },
      },
    });
    if (!player) return new Response('Not found', { status: 404 });
    const lines = [
      csvRow(['Игрок', `${player.lastName} ${player.firstName} ${player.middleName ?? ''}`]),
      csvRow(['ID', player.playerId]),
      '',
      'Дата;Сессия;Тест;Код;Результат;Ед.',
    ];
    for (const s of player.testSessions) {
      for (const r of s.testResults) {
        lines.push(
          csvRow([
            new Date(s.DateTime).toLocaleDateString('ru-RU'),
            s.sessionId,
            r.test.name,
            r.test.code,
            r.value,
            r.test.unit,
          ])
        );
      }
    }
    return csvResponse(lines, `player_${player.playerId}.csv`);
  }

  return new Response('Bad type', { status: 400 });
}
