'use server';

import { prisma } from '../../../lib/prisma';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { validatePlayerFields } from '../../../lib/player';

export async function createPlayer(formData: FormData) {
  const v = validatePlayerFields(formData);
  if (!v.ok) {
    return { error: v.error };
  }
  const d = v.data as {
    lastName: string;
    firstName: string;
    middleName: string | null;
    playerIdInput: string;
    position: string;
    height: number | null;
    birthDate: Date | null;
  };

  const team = await prisma.team.findFirst();
  if (!team) return { error: 'Команда не настроена — создайте её в настройках.' };

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
    if (dup) return { error: `Игрок с кодом «${code}» уже существует.` };
  }

  await prisma.player.create({
    data: {
      playerId: code,
      lastName: d.lastName,
      firstName: d.firstName,
      middleName: d.middleName,
      position: d.position,
      height: d.height,
      birthDate: d.birthDate,
      status: 'ACTIVE',
      teamId: team.id,
    },
  });

  revalidatePath('/players', 'layout');
  revalidatePath('/team');
  revalidatePath('/', 'layout');
  redirect('/players');
}