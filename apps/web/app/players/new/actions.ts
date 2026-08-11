'use server';

import { prisma } from '../../../lib/prisma';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function createPlayer(formData: FormData) {
  const lastName = String(formData.get('lastName') ?? '').trim();
  const firstName = String(formData.get('firstName') ?? '').trim();
  if (!lastName || !firstName) return;

  const middleName = String(formData.get('middleName') ?? '').trim() || null;
  const playerIdInput = String(formData.get('playerId') ?? '').trim();
  const position = String(formData.get('position') ?? 'outside_hitter');
  const heightStr = String(formData.get('height') ?? '').trim();
  const birthStr = String(formData.get('birthDate') ?? '').trim();

  const team = await prisma.team.findFirst();
  if (!team) return;

  let code = playerIdInput;
  if (!code) {
    let n = (await prisma.player.count()) + 1;
    code = `P${String(n).padStart(3, '0')}`;
    while (await prisma.player.findFirst({ where: { playerId: code } })) {
      n += 1;
      code = `P${String(n).padStart(3, '0')}`;
    }
  }

  await prisma.player.create({
    data: {
      playerId: code,
      lastName,
      firstName,
      middleName,
      position,
      height: heightStr ? Number(heightStr) : null,
      birthDate: birthStr ? new Date(birthStr) : null,
      status: 'ACTIVE',
      teamId: team.id,
    },
  });

  revalidatePath('/players');
  revalidatePath('/team');
  revalidatePath('/', 'layout');
  redirect('/players');
}