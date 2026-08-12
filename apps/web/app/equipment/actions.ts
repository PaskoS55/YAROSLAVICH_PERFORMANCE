'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

const str = (v: FormDataEntryValue | null) => String(v ?? '').trim();
const opt = (s: string) => (s === '' ? null : s);
const toDate = (s: string) => (s === '' ? null : new Date(s + 'T12:00:00.000Z'));

const ALLOWED = new Set(['ACTIVE', 'MAINTENANCE', 'BROKEN', 'RETIRED']);

export async function createEquipment(formData: FormData) {
  const code = str(formData.get('code')).toUpperCase();
  const name = str(formData.get('name'));
  if (!code || !name) return { error: 'Укажите код и название.' };
  const status = str(formData.get('status')) || 'ACTIVE';
  if (!ALLOWED.has(status)) return { error: 'Некорректный статус.' };

  const existing = await prisma.equipment.findUnique({ where: { code } });
  if (existing) return { error: `Код «${code}» уже используется.` };

  await prisma.equipment.create({
    data: {
      code,
      name,
      brand: opt(str(formData.get('brand'))),
      model: opt(str(formData.get('model'))),
      warrantyExp: toDate(str(formData.get('warrantyExp'))),
      status,
    },
  });
  revalidatePath('/equipment');
  return { ok: true };
}

export async function updateEquipment(formData: FormData) {
  const id = str(formData.get('id'));
  if (!id) return { error: 'Запись не найдена.' };
  const code = str(formData.get('code')).toUpperCase();
  const name = str(formData.get('name'));
  if (!code || !name) return { error: 'Укажите код и название.' };
  const status = str(formData.get('status')) || 'ACTIVE';
  if (!ALLOWED.has(status)) return { error: 'Некорректный статус.' };

  const dup = await prisma.equipment.findFirst({
    where: { code, NOT: { id } },
  });
  if (dup) return { error: `Код «${code}» уже используется другой записью.` };

  await prisma.equipment.update({
    where: { id },
    data: {
      code,
      name,
      brand: opt(str(formData.get('brand'))),
      model: opt(str(formData.get('model'))),
      warrantyExp: toDate(str(formData.get('warrantyExp'))),
      status,
    },
  });
  revalidatePath('/equipment');
  return { ok: true };
}