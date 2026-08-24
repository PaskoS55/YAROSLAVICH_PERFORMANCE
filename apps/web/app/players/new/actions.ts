'use server';

import { prisma } from '../../../lib/prisma';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { validatePlayerFields } from '../../../lib/player';
import { requireAppContext } from '../../../lib/app-context';

export async function createPlayer(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const v = validatePlayerFields(formData);
  if (!v.ok) {
    console.error('createPlayer:', v.error);
    return;
  }
  const d = v.data as {
    lastName: string;
    firstName: string;
    middleName: string | null;
    playerIdInput: string;
    position: string;
    height: number | null;
    number: number | null;
    birthDate: Date | null;
    joinedDate: Date | null;
    comment: string | null;
  };

  let code = d.playerIdInput;
  if (!code) {
    let n = (await prisma.player.count({ where: { teamId: context.teamId } })) + 1;
    code = `P${String(n).padStart(3, '0')}`;
    while (await prisma.player.findFirst({ where: { teamId: context.teamId, playerId: code } })) {
      n += 1;
      code = `P${String(n).padStart(3, '0')}`;
    }
  } else {
    const dup = await prisma.player.findUnique({
      where: { teamId_playerId: { teamId: context.teamId, playerId: code } },
    });
    if (dup) {
      console.error(
        dup.deletedAt
          ? `createPlayer: игрок с кодом «${code}» находится в архиве — восстановите его.`
          : `createPlayer: игрок с кодом «${code}» уже существует.`
      );
      return;
    }
  }

  await prisma.player.create({
    data: {
      playerId: code,
      lastName: d.lastName,
      firstName: d.firstName,
      middleName: d.middleName,
      position: d.position,
      height: d.height,
      number: d.number,
      birthDate: d.birthDate,
      joinedDate: d.joinedDate,
      comment: d.comment,
      status: 'ACTIVE',
      teamId: context.teamId,
    },
  });

  revalidatePath('/players', 'layout');
  revalidatePath('/team');
  revalidatePath('/', 'layout');
  redirect('/players');
}
