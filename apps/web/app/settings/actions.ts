'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { validateOrganizationBranding } from '@pasko-performance/core/product';
import { requireAppContext } from '../../lib/app-context';

const str = (v: FormDataEntryValue | null) => String(v ?? '').trim();
const toDate = (s: string) => (s ? new Date(s + 'T12:00:00.000Z') : null);

export async function updateOrganization(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const name = str(formData.get('name'));
  if (!name) {
    console.error('updateOrganization: название обязательно.');
    return;
  }

  let branding;
  try {
    branding = validateOrganizationBranding({
      shortName: str(formData.get('shortName')),
      logoAssetKey: str(formData.get('logoAssetKey')),
      primaryColor: str(formData.get('primaryColor')),
      secondaryColor: str(formData.get('secondaryColor')),
    });
  } catch (error) {
    console.error('updateOrganization: некорректные параметры бренда.', error);
    return;
  }
  await prisma.organization.update({ where: { id: context.organizationId }, data: { name, ...branding } });
  revalidatePath('/settings');
  revalidatePath('/team', 'layout');
}

export async function updateTeam(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const name = str(formData.get('name'));
  if (!name) {
    console.error('updateTeam: название обязательно.');
    return;
  }

  await prisma.team.update({ where: { id: context.teamId }, data: { name } });
  revalidatePath('/settings');
  revalidatePath('/team', 'layout');
}

export async function updateSeason(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const name = str(formData.get('name'));
  const startDate = str(formData.get('startDate'));
  const endDate = str(formData.get('endDate'));

  if (!name) {
    console.error('updateSeason: название сезона обязательно.');
    return;
  }
  if (!startDate || !endDate) {
    console.error('updateSeason: укажите даты начала и окончания.');
    return;
  }

  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    console.error('updateSeason: некорректные даты.');
    return;
  }
  if (end < start) {
    console.error('updateSeason: окончание сезона не может быть раньше начала.');
    return;
  }

  await prisma.season.update({ where: { id: context.seasonId }, data: { name, startDate: start, endDate: end } });

  revalidatePath('/settings');
}

export async function createTeam(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const name = str(formData.get('name'));
  const code = str(formData.get('code')).toUpperCase();
  if (!name || !/^[A-Z0-9_-]{2,32}$/.test(code)) return;
  await prisma.team.create({ data: { name, code, organizationId: context.organizationId } });
  revalidatePath('/settings');
  revalidatePath('/context');
}

export async function createSeason(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const name = str(formData.get('name'));
  const start = toDate(str(formData.get('startDate')));
  const end = toDate(str(formData.get('endDate')));
  if (!name || !start || !end || end < start) return;
  await prisma.season.create({ data: { name, startDate: start, endDate: end, teams: { connect: { id: context.teamId } } } });
  revalidatePath('/settings');
  revalidatePath('/context');
}

export async function resetDemoData(): Promise<void> {
  await requireAppContext();
  // Удаляем рабочие данные, но сохраняем нормативы, справочник тестов и оборудование
  // Порядок: дети → родители (BodyComposition имеет FK на TestSession)
  await prisma.$transaction(async (tx) => {
    await tx.qCFlag.deleteMany();
    await tx.playerGoal.deleteMany();
    await tx.testResult.deleteMany();
    await tx.bodyComposition.deleteMany();
    await tx.testSession.deleteMany();
    await tx.player.deleteMany();
    await tx.importJob.deleteMany();
    await tx.auditLog.deleteMany();
  });

  revalidatePath('/', 'layout');
  revalidatePath('/players', 'layout');
  revalidatePath('/sessions', 'layout');
  revalidatePath('/settings');
}
