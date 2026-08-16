import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

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
  ] = await Promise.all([
    prisma.organization.findMany(),
    prisma.team.findMany(),
    prisma.season.findMany(),
    prisma.testCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.player.findMany(),
    prisma.test.findMany(),
    prisma.norm.findMany(),
    prisma.testSession.findMany(),
    prisma.testResult.findMany(),
    prisma.bodyComposition.findMany(),
    prisma.playerGoal.findMany(),
    prisma.equipment.findMany(),
    prisma.qCFlag.findMany(),
    prisma.importJob.findMany(),
    prisma.auditLog.findMany(),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    brand: 'PASKO PERFORMANCE',
    version: 2,
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
  };

  const filename = `pasko-performance-backup-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}