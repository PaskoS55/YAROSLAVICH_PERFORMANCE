'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '../../lib/prisma';
import { resolveAppContext } from '../../lib/app-context-core';
import { CONTEXT_COOKIE_NAME, CONTEXT_MAX_AGE_SECONDS, contextCookieSecure, signContextSelection } from '../../lib/context-cookie';
import { operationalLicenseRequired } from '../../lib/license-policy';
import { createSeasonOnce, seasonDate } from '../../lib/seasons';

export async function selectContext(formData: FormData): Promise<void> {
  const selection = {
    organizationId: String(formData.get('organizationId') ?? ''), teamId: String(formData.get('teamId') ?? ''), seasonId: String(formData.get('seasonId') ?? ''),
  };
  const context = await resolveAppContext(prisma, selection);
  if (context.status !== 'READY') redirect('/context?state=INVALID_CONTEXT');
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) throw new Error('AUTH_SESSION_SECRET is required');
  (await cookies()).set(CONTEXT_COOKIE_NAME, await signContextSelection(selection, secret), {
    httpOnly: true, sameSite: 'lax', secure: contextCookieSecure(), path: '/', maxAge: CONTEXT_MAX_AGE_SECONDS,
  });
  redirect('/');
}

export async function createContextTeam(formData: FormData): Promise<void> {
  operationalLicenseRequired();
  const organizationId = String(formData.get('organizationId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  if (!name || !/^[A-Z0-9_-]{2,32}$/.test(code)) redirect('/context?state=INVALID_TEAM');
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, deletedAt: true },
  });
  if (!organization || organization.deletedAt) redirect('/context?state=INVALID_TEAM');
  try {
    await prisma.team.create({ data: { organizationId: organization.id, name, code } });
  } catch {
    redirect('/context?state=TEAM_CREATE_FAILED');
  }
  redirect('/context');
}

export async function createContextSeason(formData: FormData): Promise<void> {
  operationalLicenseRequired();
  const teamId = String(formData.get('teamId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const startDate = seasonDate(String(formData.get('startDate') ?? ''));
  const endDate = seasonDate(String(formData.get('endDate') ?? ''));
  if (!name || !startDate || !endDate || endDate < startDate) {
    redirect('/context?state=INVALID_SEASON');
  }
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, deletedAt: true, organization: { select: { deletedAt: true } } },
  });
  if (!team || team.deletedAt || team.organization.deletedAt) redirect('/context?state=INVALID_SEASON');
  try {
    await createSeasonOnce(prisma, team.id, name, startDate, endDate);
  } catch {
    redirect('/context?state=SEASON_CREATE_FAILED');
  }
  redirect('/context');
}
