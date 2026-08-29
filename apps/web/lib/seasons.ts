import type { PrismaClient } from '@prisma/client';
import { measurementDay } from './measurement-date';

export function seasonDate(value: string): Date | null {
  try { measurementDay(value); } catch { return null; }
  return new Date(`${value}T12:00:00.000Z`);
}

// The same team/name/period submitted again is a retry, not a second season.
// Lock the owning team to serialize concurrent requests without a schema change.
export async function createSeasonOnce(db: PrismaClient, teamId: string, name: string, startDate: Date, endDate: Date) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM teams WHERE id = ${teamId} FOR UPDATE`;
    const existing = await tx.season.findFirst({where: {name, startDate, endDate, deletedAt: null, teams: {some: {id: teamId}}}});
    return existing ?? tx.season.create({data: {name, startDate, endDate, teams: {connect: {id: teamId}}}});
  });
}
