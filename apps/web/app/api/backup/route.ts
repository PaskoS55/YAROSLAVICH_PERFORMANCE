import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [
    organizations,
    teams,
    seasons,
    testCategories,
    players,
    tests,
    norms,
    testSessions,
    testResults,
    bodyCompositions,
    playerGoals,
    equipment,
    qcFlags,
    importJobs,
    auditLogs,
  ] = await prisma.$transaction(
    async (tx) =>
      Promise.all([
        tx.organization.findMany(),
        tx.team.findMany({ include: { seasons: { select: { id: true } } } }),
        tx.season.findMany(),
        tx.testCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
        tx.player.findMany(),
        tx.test.findMany(),
        tx.norm.findMany(),
        tx.testSession.findMany(),
        tx.testResult.findMany(),
        tx.bodyComposition.findMany(),
        tx.playerGoal.findMany(),
        tx.equipment.findMany(),
        tx.qCFlag.findMany(),
        tx.importJob.findMany(),
        tx.auditLog.findMany(),
      ]),
    { isolationLevel: 'RepeatableRead' }
  );

  // Связь Team ↔ Season — implicit many-to-many Prisma.
  // findMany() её не возвращает, поэтому формируем явно для полного бэкапа.
  const teamSeasonLinks = teams.flatMap((t) =>
    t.seasons.map((s) => ({ teamId: t.id, seasonId: s.id }))
  );

  const backup = {
    exportedAt: new Date().toISOString(),
    brand: 'PASKO PERFORMANCE',
    version: 3,
    organizations,
    teams: teams.map(({ seasons: _s, ...rest }) => rest),
    seasons,
    testCategories,
    players,
    tests,
    norms,
    testSessions,
    testResults,
    bodyCompositions,
    playerGoals,
    equipment,
    qcFlags,
    importJobs,
    auditLogs,
    teamSeasonLinks,
  };

  const filename = `pasko-performance-backup-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
