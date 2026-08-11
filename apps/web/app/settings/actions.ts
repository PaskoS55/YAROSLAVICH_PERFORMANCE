'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function updateOrganization(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  if (!name || !code) return;
  
  await prisma.organization.updateMany({
    data: { name, code },
  });
  revalidatePath('/settings');
  revalidatePath('/team', 'layout');
}

export async function updateTeam(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  if (!name || !code) return;
  
  await prisma.team.updateMany({
    data: { name, code },
  });
  revalidatePath('/settings');
  revalidatePath('/team', 'layout');
}

export async function updateSeason(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const startDate = String(formData.get('startDate') ?? '');
  const endDate = String(formData.get('endDate') ?? '');
  if (!name || !startDate || !endDate) return;
  
  await prisma.season.updateMany({
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  });
  revalidatePath('/settings');
}

export async function resetDemoData() {
  // Удаляем все данные (кроме справочников тестов)
  await prisma.qCFlag.deleteMany();
  await prisma.playerGoal.deleteMany();
  await prisma.testResult.deleteMany();
  await prisma.testSession.deleteMany();
  await prisma.bodyComposition.deleteMany();
  await prisma.norm.deleteMany();
  await prisma.player.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.auditLog.deleteMany();
  
  revalidatePath('/', 'layout');
  revalidatePath('/players', 'layout');
  revalidatePath('/sessions', 'layout');
  revalidatePath('/settings');
}