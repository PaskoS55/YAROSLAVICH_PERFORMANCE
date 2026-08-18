'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function resolveFlag(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const reason = String(formData.get('reason') ?? 'manual').trim() || 'manual';

  const flag = await prisma.qCFlag.findUnique({ where: { id } });
  if (!flag) {
    console.error('resolveFlag: флаг не найден.');
    return;
  }
  if (flag.resolved) {
    console.error('resolveFlag: флаг уже решён.');
    return;
  }

  await prisma.qCFlag.update({
    where: { id },
    data: { resolved: true, resolvedAt: new Date(), resolvedBy: reason },
  });
  revalidatePath('/qc');
}