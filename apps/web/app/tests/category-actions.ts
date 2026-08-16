'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

export type CategoryState = { ok?: boolean; error?: string } | null;

export async function updateCategories(
  _state: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  const ids = formData.getAll('catId').map((v) => String(v));

  const updates: { id: string; includeInRadar: boolean; radarOrder: number | null }[] = [];
  const seen = new Set<number>();

  for (const id of ids) {
    const include = String(formData.get(`inc_${id}`)) === '1';
    const posRaw = String(formData.get(`pos_${id}`) ?? '').trim();

    if (include) {
      const n = Number(posRaw);
      if (!Number.isFinite(n) || n < 1)
        return { error: 'Некорректный порядок категорий.' };
      const pos = Math.round(n);
      if (seen.has(pos)) return { error: 'Порядок категорий должен быть уникальным.' };
      seen.add(pos);
      updates.push({ id, includeInRadar: true, radarOrder: pos });
    } else {
      if (posRaw !== '') return { error: 'Порядок задан для выключенной категории.' };
      updates.push({ id, includeInRadar: false, radarOrder: null });
    }
  }

  const includedCount = updates.filter((u) => u.includeInRadar).length;
  if (includedCount > 0) {
    const sorted = [...seen].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i + 1)
        return { error: 'Порядок категорий должен быть непрерывным: 1…N.' };
    }
  }

  // Либо всё, либо ничего: частичная конфигурация радара невозможна
  await prisma.$transaction(
    updates.map((u) =>
      prisma.testCategory.update({
        where: { id: u.id },
        data: { includeInRadar: u.includeInRadar, radarOrder: u.radarOrder },
      })
    )
  );

  revalidatePath('/tests', 'layout');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/players', 'layout');
  return { ok: true };
}