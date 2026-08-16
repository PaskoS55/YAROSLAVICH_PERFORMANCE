'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function updateCategories(formData: FormData) {
  const ids = formData.getAll('catId').map((v) => String(v));
  for (const id of ids) {
    const include = formData.get(`inc_${id}`) === 'on';
    const ordRaw = String(formData.get(`ord_${id}`) ?? '').trim();
    let ord: number | null = null;
    if (ordRaw !== '') {
      const n = Number(ordRaw);
      if (!Number.isFinite(n)) return { error: 'Порядок на радаре должен быть числом.' };
      ord = Math.round(n);
    }
    await prisma.testCategory.update({
      where: { id },
      data: { includeInRadar: include, radarOrder: ord },
    });
  }
  revalidatePath('/tests', 'layout');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/players', 'layout');
  return { ok: true };
}