'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function updatePlayerStatus(formData: FormData) {
  const id = String(formData.get('id'));
  const status = String(formData.get('status')) as 'ACTIVE' | 'INJURED' | 'LIMITED' | 'INACTIVE';
  await prisma.player.update({
    where: { id },
    data: { status },
  });
  revalidatePath('/team');
  revalidatePath('/players', 'layout');
  revalidatePath('/', 'layout');
}

export async function createPlayer(formData: FormData) {
  const playerId = String(formData.get('playerId') ?? '').trim();
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const middleName = String(formData.get('middleName') ?? '').trim();
  const position = String(formData.get('position') ?? '').trim();
  const status = String(formData.get('status') ?? 'ACTIVE') as 'ACTIVE' | 'INJURED' | 'LIMITED' | 'INACTIVE';
  const numberStr = String(formData.get('number') ?? '').trim();
  const heightStr = String(formData.get('height') ?? '').trim();
  const birthDateStr = String(formData.get('birthDate') ?? '').trim();
  const joinedDateStr = String(formData.get('joinedDate') ?? '').trim();

  if (!playerId || !firstName || !lastName || !position) {
    return { error: 'Заполните обязательные поля: ID, Имя, Фамилия, Амплуа' };
  }

  const team = await prisma.team.findFirst();
  if (!team) return { error: 'Команда не найдена' };

  // Проверка уникальности playerId в команде
  const exists = await prisma.player.findFirst({
    where: { playerId, teamId: team.id, deletedAt: null },
  });
  if (exists) {
    return { error: `Игрок с ID ${playerId} уже существует` };
  }

  await prisma.player.create({
    data: {
      playerId,
      firstName,
      lastName,
      middleName: middleName || null,
      position,
      status,
      number: numberStr ? parseInt(numberStr, 10) : null,
      height: heightStr ? parseInt(heightStr, 10) : null,
      birthDate: birthDateStr ? new Date(birthDateStr) : null,
      joinedDate: joinedDateStr ? new Date(joinedDateStr) : null,
      teamId: team.id,
    },
  });

  revalidatePath('/team');
  revalidatePath('/players', 'layout');
  revalidatePath('/compare', 'layout');
  revalidatePath('/dynamics', 'layout');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/body', 'layout');
  revalidatePath('/', 'layout');

  return { ok: true };
}