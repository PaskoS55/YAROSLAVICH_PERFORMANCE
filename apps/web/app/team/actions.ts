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
}