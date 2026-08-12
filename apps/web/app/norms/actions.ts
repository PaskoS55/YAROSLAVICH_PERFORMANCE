'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

export type NormState = { ok?: boolean; error?: string } | null;

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim().replace(',', '.');
  return s === '' ? NaN : Number(s);
};
export async function updateNorm(_state: NormState, formData: FormData): Promise<NormState> {
  const id = String(formData.get('id'));
  const norm = await prisma.norm.findUnique({ where: { id } });
  if (!norm) return { error: 'Норматив не найден.' };

  const test = await prisma.test.findFirst({
    where: { code: norm.testCode, deletedAt: null },
  });
  if (!test) return { error: 'Тест не найден.' };

  const values = [
    num(formData.get('anchor10')),
    num(formData.get('anchor25')),
    num(formData.get('anchor50')),
    num(formData.get('anchor75')),
    num(formData.get('anchor90')),
  ];
  if (values.some((v) => !Number.isFinite(v))) {
    return { error: 'Все пять значений должны быть числами.' };
  }
  const [a10, a25, a50, a75, a90] = values;
  const asc = a10 <= a25 && a25 <= a50 && a50 <= a75 && a75 <= a90;
  const desc = a10 >= a25 && a25 >= a50 && a50 >= a75 && a75 >= a90;

  if (test.direction === 'HIGHER_IS_BETTER' && !asc) {
    return {
      error: 'Для «больше — лучше» значения должны возрастать: p10 ≤ p25 ≤ p50 ≤ p75 ≤ p90.',
    };
  }
  if (test.direction === 'LOWER_IS_BETTER' && !desc) {
    return {
      error: 'Для «меньше — лучше» значения должны убывать: p10 ≥ p25 ≥ p50 ≥ p75 ≥ p90.',
    };
  }

  await prisma.norm.update({
    where: { id },
    data: {
      anchor10: a10,
      anchor25: a25,
      anchor50: a50,
      anchor75: a75,
      anchor90: a90,
    },
  });

  revalidatePath('/norms');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/compare', 'layout');
  return { ok: true };
}