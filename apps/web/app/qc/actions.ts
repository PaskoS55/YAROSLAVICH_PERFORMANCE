'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function resolveFlag(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const reason = String(formData.get('reason') ?? 'manual').trim() || 'manual';

  const flag = await prisma.qCFlag.findUnique({ where: { id } });
  if (!flag) return { error: 'Флаг не найден.' };
  if (flag.resolved) return { error: 'Флаг уже решён.' };

  await prisma.qCFlag.update({
    where: { id },
    data: { resolved: true, resolvedAt: new Date(), resolvedBy: reason },
  });
  revalidatePath('/qc');
  return { ok: true };
}