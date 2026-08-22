import 'server-only';
import { notFound } from 'next/navigation';
import { prisma } from './prisma';
import type { ReadyAppContext } from './app-context-core';

export const activePlayerWhere = (context: ReadyAppContext) => ({ teamId: context.teamId, deletedAt: null } as const);
export const activeSessionWhere = (context: ReadyAppContext) => ({ teamId: context.teamId, seasonId: context.seasonId, deletedAt: null } as const);
export const activeResultWhere = (context: ReadyAppContext) => ({ deletedAt: null, player: { teamId: context.teamId }, testSession: { teamId: context.teamId, seasonId: context.seasonId, deletedAt: null } } as const);

export async function getPlayerForContext(context: ReadyAppContext, id: string, includeArchived = false) {
  const player = await prisma.player.findFirst({ where: { id, teamId: context.teamId, ...(includeArchived ? {} : { deletedAt: null }) } });
  if (!player) notFound();
  return player;
}

export async function assertPlayerInContext(context: ReadyAppContext, id: string, includeArchived = false) {
  return getPlayerForContext(context, id, includeArchived);
}

export async function getSessionForContext(context: ReadyAppContext, id: string, includeArchived = false) {
  const session = await prisma.testSession.findFirst({ where: { id, teamId: context.teamId, seasonId: context.seasonId, ...(includeArchived ? {} : { deletedAt: null }) } });
  if (!session) notFound();
  return session;
}
