'use server';

import { prisma } from '../../../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { validatePlayerFields } from '../../../../lib/player';

export async function updatePlayer(formData: FormData) {
  const id = String(formData.get('id'));

  const existing = await prisma.player.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return { error: 'Игрок не найден или удалён.' };

  const v = validatePlayerFields(formData);
  if (!v.ok) return { error: v.error };
  const d = v.data as {
    lastName: string;
    firstName: string;
    middleName: string | null;
    playerIdInput: string;
    position: string;
    status: string;
    height: number | null;
    number: number | null;
    birthDate: Date | null;
    joinedDate: Date | null;
    comment: string | null;
  };

  const code = d.playerIdInput || existing.playerId;
  if (code !== existing.playerId) {
    const dup = await prisma.player.findFirst({ where: { playerId: code, deletedAt: null } });
    if (dup) return { error: `Игрок с кодом «${code}» уже существует.` };
  }

  await prisma.player.update({
    where: { id },
    data: {
      playerId: code,
      firstName: d.firstName,
      lastName: d.lastName,
      middleName: d.middleName,
      position: d.position,
      status: d.status as 'ACTIVE' | 'INJURED' | 'LIMITED' | 'INACTIVE',
      number: d.number,
      height: d.height,
      birthDate: d.birthDate,
      joinedDate: d.joinedDate,
      comment: d.comment,
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
  const existing = await prisma.player.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return { error: 'Игрок не найден или уже удалён.' };

  await prisma.player.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath('/players', 'layout');
  revalidatePath('/team');
  revalidatePath('/', 'layout');
  redirect('/players');
}

export async function restorePlayer(formData: FormData) {
  const id = String(formData.get('id'));
  const existing = await prisma.player.findFirst({ where: { id, NOT: { deletedAt: null } } });
  if (!existing) return { error: 'Игрок не найден или не удалён.' };

  await prisma.player.update({ where: { id }, data: { deletedAt: null } });
  revalidatePath('/players', 'layout');
  revalidatePath('/team');
  revalidatePath('/', 'layout');
  redirect(`/players/${id}`);
}