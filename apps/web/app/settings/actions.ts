'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { validateOrganizationBranding } from '@pasko-performance/core/product';

const str = (v: FormDataEntryValue | null) => String(v ?? '').trim();
const toDate = (s: string) => (s ? new Date(s + 'T12:00:00.000Z') : null);

export async function updateOrganization(formData: FormData): Promise<void> {
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
  const org = await prisma.organization.findFirst();
  if (org) {
    await prisma.organization.update({ where: { id: org.id }, data: { name, ...branding } });
  } else {
    await prisma.organization.create({ data: { name, code: 'ORG', ...branding } });
  }
  revalidatePath('/settings');
  revalidatePath('/team', 'layout');
}

export async function updateTeam(formData: FormData): Promise<void> {
  const name = str(formData.get('name'));
  if (!name) {
    console.error('updateTeam: название обязательно.');
    return;
  }

  // Team требует organizationId — находим или создаём Organization
  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({ data: { name: 'Организация', code: 'ORG' } });
  }

  const team = await prisma.team.findFirst();
  if (team) {
    await prisma.team.update({ where: { id: team.id }, data: { name } });
  } else {
    await prisma.team.create({
      data: {
        name,
        code: 'TEAM',
        organizationId: org.id,
      },
    });
  }
  revalidatePath('/settings');
  revalidatePath('/team', 'layout');
}

export async function updateSeason(formData: FormData): Promise<void> {
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

  const season = await prisma.season.findFirst();
  if (season) {
    await prisma.season.update({
      where: { id: season.id },
      data: { name, startDate: start, endDate: end },
    });
  } else {
    await prisma.season.create({ data: { name, startDate: start, endDate: end } });
  }

  revalidatePath('/settings');
}

export async function resetDemoData(): Promise<void> {
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
