'use server';

import { prisma } from '../../../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function updatePlayer(formData: FormData) {
  const id = String(formData.get('id'));
  const playerId = String(formData.get('playerId') ?? '').trim();
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const middleName = String(formData.get('middleName') ?? '').trim();
  const position = String(formData.get('position') ?? '').trim();
  const status = String(formData.get('status')) as 'ACTIVE' | 'INJURED' | 'LIMITED' | 'INACTIVE';
  const numberStr = String(formData.get('number') ?? '').trim();
  const heightStr = String(formData.get('height') ?? '').trim();
  const birthDateStr = String(formData.get('birthDate') ?? '').trim();
  const joinedDateStr = String(formData.get('joinedDate') ?? '').trim();
  const comment = String(formData.get('comment') ?? '').trim();

  if (!playerId || !firstName || !lastName || !position) return;

  await prisma.player.update({
    where: { id },
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
      comment: comment || null,
    },
  });

  revalidatePath('/players', 'layout');
  revalidatePath('/team');
  revalidatePath('/compare', 'layout');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/', 'layout');
  redirect(`/players/${id}`);
}

export async function archivePlayer(formData: FormData) {
  const id = String(formData.get('id'));
  await prisma.player.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath('/players', 'layout');
  revalidatePath('/team');
  revalidatePath('/', 'layout');
  redirect('/players');
}

export async function restorePlayer(formData: FormData) {
  const id = String(formData.get('id'));
  await prisma.player.update({
    where: { id },
    data: { deletedAt: null },
  });
  revalidatePath('/players', 'layout');
  revalidatePath('/team');
  revalidatePath('/', 'layout');
  redirect(`/players/${id}`);
}