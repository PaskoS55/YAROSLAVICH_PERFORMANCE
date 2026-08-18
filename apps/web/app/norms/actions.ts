'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

export type NormState = { ok?: boolean; error?: string } | null;

const positionLabels: Record<string, string> = {
  outside_hitter: 'Доигровщик',
  opposite: 'Диагональный',
  middle_blocker: 'Центральный',
  setter: 'Связующий',
  libero: 'Либеро',
};

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim().replace(',', '.');
  return s === '' ? NaN : Number(s);
};

function checkOrder(direction: string, a: number[]): string | null {
  const [a10, a25, a50, a75, a90] = a;
  const asc = a10 <= a25 && a25 <= a50 && a50 <= a75 && a75 <= a90;
  const desc = a10 >= a25 && a25 >= a50 && a50 >= a75 && a75 >= a90;
  if (direction === 'HIGHER_IS_BETTER' && !asc)
    return 'для «больше — лучше» значения должны возрастать: p10 ≤ p25 ≤ p50 ≤ p75 ≤ p90.';
  if (direction === 'LOWER_IS_BETTER' && !desc)
    return 'для «меньше — лучше» значения должны убывать: p10 ≥ p25 ≥ p50 ≥ p75 ≥ p90.';
  return null;
}

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
  const orderError = checkOrder(test.direction, values);
  if (orderError) return { error: orderError.charAt(0).toUpperCase() + orderError.slice(1) };

  await prisma.norm.update({
    where: { id },
    data: {
      anchor10: values[0],
      anchor25: values[1],
      anchor50: values[2],
      anchor75: values[3],
      anchor90: values[4],
    },
  });

  revalidatePath('/norms');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/compare', 'layout');
  return { ok: true };
}

export async function createNorms(_state: NormState, formData: FormData): Promise<NormState> {
  const testCode = String(formData.get('testCode') ?? '').trim();
  const test = await prisma.test.findFirst({ where: { code: testCode, deletedAt: null } });
  if (!test) return { error: 'Тест не найден.' };

  const rows: { position: string; values: number[] }[] = [];
  for (const pos of Object.keys(positionLabels)) {
    const values = [10, 25, 50, 75, 90].map((p) => num(formData.get(`a${p}_${pos}`)));
    if (values.some((v) => !Number.isFinite(v)))
      return { error: `Заполните все пять значений для позиции «${positionLabels[pos]}».` };
    const orderError = checkOrder(test.direction, values);
    if (orderError) return { error: `«${positionLabels[pos]}»: ${orderError}` };
    const existing = await prisma.norm.findFirst({
      where: { testCode, position: pos, deletedAt: null },
    });
    if (existing)
      return { error: `Для позиции «${positionLabels[pos]}» норматив уже существует.` };
    rows.push({ position: pos, values });
  }

  await prisma.norm.createMany({
    data: rows.map((r) => ({
      testCode: testCode,
      position: r.position,
      anchor10: r.values[0],
      anchor25: r.values[1],
      anchor50: r.values[2],
      anchor75: r.values[3],
      anchor90: r.values[4],
      source: 'manual',
    })),
  });

  revalidatePath('/norms');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/compare', 'layout');
  revalidatePath('/tests', 'layout');
  return { ok: true };
}