'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function resolveFlag(formData: FormData) {
  const id = String(formData.get('id'));
  await prisma.qCFlag.update({
    where: { id },
    data: { resolved: true, resolvedAt: new Date(), resolvedBy: 'manual' },
  });
  revalidatePath('/qc');
}