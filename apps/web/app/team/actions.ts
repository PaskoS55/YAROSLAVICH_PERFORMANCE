'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function updatePlayerStatus(formData: FormData): Promise<void> {
  const id = String(formData.get('id'));
  const status = String(formData.get('status'));
  if (!['ACTIVE', 'INJURED', 'LIMITED', 'INACTIVE'].includes(status)) {
    console.error('updatePlayerStatus: некорректный статус.');
    return;
  }
  await prisma.player.update({
    where: { id },
    data: { status: status as 'ACTIVE' | 'INJURED' | 'LIMITED' | 'INACTIVE' },
  });
  revalidatePath('/team');
  revalidatePath('/players', 'layout');
  revalidatePath('/', 'layout');
}

export async function createPlayer(formData: FormData): Promise<void> {
  const playerId = String(formData.get('playerId') ?? '').trim();
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const middleName = String(formData.get('middleName') ?? '').trim();
  const position = String(formData.get('position') ?? '').trim();
  const status = String(formData.get('status') ?? 'ACTIVE');
  const numberStr = String(formData.get('number') ?? '').trim();
  const heightStr = String(formData.get('height') ?? '').trim();
  const birthDateStr = String(formData.get('birthDate') ?? '').trim();
  const joinedDateStr = String(formData.get('joinedDate') ?? '').trim();

  if (!playerId || !firstName || !lastName || !position) {
    console.error('createPlayer: заполните обязательные поля.');
    return;
  }

  const team = await prisma.team.findFirst();
  if (!team) {
    console.error('createPlayer: команда не найдена.');
    return;
  }

  const exists = await prisma.player.findUnique({
    where: { teamId_playerId: { teamId: team.id, playerId } },
  });
  if (exists) {
    console.error(
      exists.deletedAt
        ? `createPlayer: игрок с ID ${playerId} находится в архиве — восстановите его.`
        : `createPlayer: игрок с ID ${playerId} уже существует.`
    );
    return;
  }

  const number = numberStr ? parseInt(numberStr, 10) : null;
  const height = heightStr ? parseInt(heightStr, 10) : null;
  const birthDate = birthDateStr ? new Date(birthDateStr + 'T12:00:00.000Z') : null;
  const joinedDate = joinedDateStr ? new Date(joinedDateStr + 'T12:00:00.000Z') : null;

  await prisma.player.create({
    data: {
      playerId,
      firstName,
      lastName,
      middleName: middleName || null,
      position,
      status: (['ACTIVE', 'INJURED', 'LIMITED', 'INACTIVE'].includes(status)
        ? status
        : 'ACTIVE') as 'ACTIVE' | 'INJURED' | 'LIMITED' | 'INACTIVE',
      number: Number.isFinite(number) ? number : null,
      height: Number.isFinite(height) ? height : null,
      birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : null,
      joinedDate: joinedDate && !Number.isNaN(joinedDate.getTime()) ? joinedDate : null,
      teamId: team.id,
    },
  });

  revalidatePath('/team');
  revalidatePath('/players', 'layout');
  revalidatePath('/compare', 'layout');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/body', 'layout');
  revalidatePath('/', 'layout');
}
