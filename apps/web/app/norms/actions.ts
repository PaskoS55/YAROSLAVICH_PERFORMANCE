'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

const num = (v: FormDataEntryValue | null) =>
  Number(String(v ?? '').replace(',', '.'));

export async function updateNorm(formData: FormData) {
  const id = String(formData.get('id'));
  await prisma.norm.update({
    where: { id },
    data: {
      anchor10: num(formData.get('anchor10')),
      anchor25: num(formData.get('anchor25')),
      anchor50: num(formData.get('anchor50')),
      anchor75: num(formData.get('anchor75')),
      anchor90: num(formData.get('anchor90')),
    },
  });
  revalidatePath('/norms');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/compare', 'layout');
  revalidatePath('/dynamics', 'layout');
}