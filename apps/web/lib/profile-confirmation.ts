import 'server-only';
import { prisma } from './prisma';
import { matchesProfileConfirmation, PROFILE_CONFIRMATION_ACTION, profileConfirmation } from './player-profile';

export async function hasProfileConfirmation(teamId: string, profile: Parameters<typeof profileConfirmation>[0]) {
  const record = await prisma.auditLog.findFirst({ where: { action: PROFILE_CONFIRMATION_ACTION, entity: 'Team', entityId: teamId }, orderBy: { createdAt: 'desc' }, select: { newValues: true } });
  return matchesProfileConfirmation(record?.newValues, profile);
}
