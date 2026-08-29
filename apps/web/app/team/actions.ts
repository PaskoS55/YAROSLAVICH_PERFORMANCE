'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireAppContext } from '../../lib/app-context';
import { validatePlayerFields } from '../../lib/player';
import { redirect } from 'next/navigation';

export async function updatePlayerStatus(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const id = String(formData.get('id'));
  const status = String(formData.get('status'));
  if (!['ACTIVE', 'INJURED', 'LIMITED', 'INACTIVE'].includes(status)) {
    console.error('updatePlayerStatus: некорректный статус.');
    return;
  }
  const player = await prisma.player.findFirst({ where: { id, teamId: context.teamId, deletedAt: null }, select: { id: true } });
  if (!player) return;
  await prisma.player.update({
    where: { id: player.id },
    data: { status: status as 'ACTIVE' | 'INJURED' | 'LIMITED' | 'INACTIVE' },
  });
  revalidatePath('/team');
  revalidatePath('/players', 'layout');
  revalidatePath('/', 'layout');
}

export async function createPlayer(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const validated = validatePlayerFields(formData);
  if (!validated.ok) redirect(`/team?error=${encodeURIComponent(validated.error)}`);
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
    redirect('/team?error=Заполните обязательные поля.');
  }

  const exists = await prisma.player.findUnique({
    where: { teamId_playerId: { teamId: context.teamId, playerId } },
  });
  if (exists) {
    console.error(
      exists.deletedAt
        ? `createPlayer: игрок с ID ${playerId} находится в архиве — восстановите его.`
        : `createPlayer: игрок с ID ${playerId} уже существует.`
    );
    return;
  }

  const number = numberStr ? validated.data.number as number : null;
  const height = heightStr ? validated.data.height as number : null;
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
      teamId: context.teamId,
    },
  });

  revalidatePath('/team');
  revalidatePath('/players', 'layout');
  revalidatePath('/compare', 'layout');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/body', 'layout');
  revalidatePath('/', 'layout');
}
