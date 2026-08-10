'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createEquipment(formData: FormData) {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const brand = String(formData.get('brand') ?? '').trim();
  const model = String(formData.get('model') ?? '').trim();
  if (!code || !name) return;
  await prisma.equipment.create({
    data: { code, name, brand: brand || null, model: model || null },
  });
  revalidatePath('/equipment');
}