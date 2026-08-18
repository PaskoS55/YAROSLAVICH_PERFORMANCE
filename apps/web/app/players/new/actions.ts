'use server';

import { prisma } from '../../../lib/prisma';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { validatePlayerFields } from '../../../lib/player';

export async function createPlayer(formData: FormData): Promise<void> {
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

  const team = await prisma.team.findFirst();
  if (!team) {
    console.error('createPlayer: команда не настроена — создайте её в настройках.');
    return;
  }

  let code = d.playerIdInput;
  if (!code) {
    let n = (await prisma.player.count()) + 1;
    code = `P${String(n).padStart(3, '0')}`;
    while (await prisma.player.findFirst({ where: { playerId: code } })) {
      n += 1;
      code = `P${String(n).padStart(3, '0')}`;
    }
  } else {
    const dup = await prisma.player.findFirst({ where: { playerId: code, deletedAt: null } });
    if (dup) {
      console.error(`createPlayer: игрок с кодом «${code}» уже существует.`);
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
      teamId: team.id,
    },
  });

  revalidatePath('/players', 'layout');
  revalidatePath('/team');
  revalidatePath('/', 'layout');
  redirect('/players');
}