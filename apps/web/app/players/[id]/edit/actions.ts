'use server';

import { prisma } from '../../../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { validatePlayerFields } from '../../../../lib/player';
import { requireAppContext } from '../../../../lib/app-context';

export async function updatePlayer(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const id = String(formData.get('id'));

  const existing = await prisma.player.findFirst({ where: { id, teamId: context.teamId, deletedAt: null } });
  if (!existing) {
    console.error('updatePlayer: игрок не найден или удалён.');
    return;
  }

  const v = validatePlayerFields(formData);
  if (!v.ok) {
    console.error('updatePlayer:', v.error);
    return;
  }
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
    const dup = await prisma.player.findUnique({
      where: { teamId_playerId: { teamId: existing.teamId, playerId: code } },
    });
    if (dup) {
      console.error(
        dup.deletedAt
          ? `updatePlayer: игрок с кодом «${code}» находится в архиве — восстановите его.`
          : `updatePlayer: игрок с кодом «${code}» уже существует.`
      );
      return;
    }
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

export async function archivePlayer(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const id = String(formData.get('id'));
  const existing = await prisma.player.findFirst({ where: { id, teamId: context.teamId, deletedAt: null } });
  if (!existing) {
    console.error('archivePlayer: игрок не найден или уже удалён.');
    return;
  }

  await prisma.player.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath('/players', 'layout');
  revalidatePath('/team');
  revalidatePath('/', 'layout');
  redirect('/players');
}

export async function restorePlayer(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const id = String(formData.get('id'));
  const existing = await prisma.player.findFirst({ where: { id, teamId: context.teamId, NOT: { deletedAt: null } } });
  if (!existing) {
    console.error('restorePlayer: игрок не найден или не удалён.');
    return;
  }

  await prisma.player.update({ where: { id }, data: { deletedAt: null } });
  revalidatePath('/players', 'layout');
  revalidatePath('/team');
  revalidatePath('/', 'layout');
  redirect(`/players/${id}`);
}
