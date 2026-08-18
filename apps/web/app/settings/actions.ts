'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

const str = (v: FormDataEntryValue | null) => String(v ?? '').trim();
const toDate = (s: string) => (s ? new Date(s + 'T12:00:00.000Z') : null);

export async function updateOrganization(formData: FormData) {
  const name = str(formData.get('name'));
  if (!name) return { error: 'Название обязательно.' };

  const org = await prisma.organization.findFirst();
  if (org) {
    await prisma.organization.update({ where: { id: org.id }, data: { name } });
  } else {
    await prisma.organization.create({ data: { name, code: 'ORG' } });
  }
  revalidatePath('/settings');
  revalidatePath('/team', 'layout');
  return { ok: true };
}

export async function updateTeam(formData: FormData) {
  const name = str(formData.get('name'));
  if (!name) return { error: 'Название обязательно.' };

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
  return { ok: true };
}

export async function updateSeason(formData: FormData) {
  const name = str(formData.get('name'));
  const startDate = str(formData.get('startDate'));
  const endDate = str(formData.get('endDate'));

  if (!name) return { error: 'Название сезона обязательно.' };
  if (!startDate || !endDate) return { error: 'Укажите даты начала и окончания.' };

  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'Некорректные даты.' };
  }
  if (end < start) {
    return { error: 'Окончание сезона не может быть раньше начала.' };
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
  return { ok: true };
}

export async function resetDemoData() {
  // Удаляем рабочие данные, но сохраняем нормативы, справочник тестов и оборудование
  // Порядок: дети → родители (BodyComposition имеет FK на TestSession)
  await prisma.qCFlag.deleteMany();
  await prisma.playerGoal.deleteMany();
  await prisma.testResult.deleteMany();
  await prisma.bodyComposition.deleteMany();
  await prisma.testSession.deleteMany();
  await prisma.player.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.auditLog.deleteMany();

  revalidatePath('/', 'layout');
  revalidatePath('/players', 'layout');
  revalidatePath('/sessions', 'layout');
  revalidatePath('/settings');
  return { ok: true };
}