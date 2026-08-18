'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import type { Direction } from '@prisma/client';

const str = (v: FormDataEntryValue | null) => String(v ?? '').trim();

type NumParse = { value: number | null } | { error: string };

function parseNum(s: string, label: string): NumParse {
  const t = s.replace(',', '.');
  if (t === '') return { value: null };
  const n = Number(t);
  if (!Number.isFinite(n)) return { error: `«${label}»: введите число.` };
  return { value: n };
}

const DIRECTIONS = new Set(['HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'CONTEXTUAL']);

function revalidateAll() {
  revalidatePath('/tests', 'layout');
  revalidatePath('/protocols');
  revalidatePath('/testing', 'layout');
  revalidatePath('/norms');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/compare');
  revalidatePath('/goals', 'layout');
  revalidatePath('/players', 'layout');
}

async function resolveCategory(formData: FormData): Promise<string | { error: string }> {
  let categoryId = str(formData.get('categoryId'));
  const newCat = str(formData.get('newCategory'));
  if (categoryId === '__new__') {
    if (!newCat) return { error: 'Укажите название новой категории.' };
    const existing = await prisma.testCategory.findFirst({
      where: { name: { equals: newCat, mode: 'insensitive' } },
    });
    categoryId = existing
      ? existing.id
      : (
          await prisma.testCategory.create({
            data: {
              code: 'CUSTOM_' + randomUUID().slice(0, 8).toUpperCase(),
              name: newCat,
              sortOrder: 100,
            },
          })
        ).id;
  }
  if (!categoryId) return { error: 'Выберите категорию.' };
  const cat = await prisma.testCategory.findUnique({ where: { id: categoryId } });
  if (!cat || !cat.active) return { error: 'Категория не найдена или неактивна.' };
  return cat.id;
}

function buildProtocol(formData: FormData) {
  const rules = formData
    .getAll('rules')
    .map((r) => str(r))
    .filter(Boolean);
  return JSON.stringify({
    how: str(formData.get('how')),
    result: str(formData.get('result')),
    rules,
  });
}

type NumericFields = {
  qcMin: number | null;
  qcMax: number | null;
  changeThreshold: number | null;
  cv: number | null;
  alertBelow: number | null;
  alertAbove: number | null;
};

function parseNumericFields(formData: FormData): NumericFields | { error: string } {
  const qcMin = parseNum(str(formData.get('qcMin')), 'QC минимум');
  if ('error' in qcMin) return qcMin;
  const qcMax = parseNum(str(formData.get('qcMax')), 'QC максимум');
  if ('error' in qcMax) return qcMax;
  const changeThreshold = parseNum(str(formData.get('changeThreshold')), 'MDC');
  if ('error' in changeThreshold) return changeThreshold;
  const cv = parseNum(str(formData.get('cv')), 'CV');
  if ('error' in cv) return cv;
  const alertBelow = parseNum(str(formData.get('alertBelow')), 'Порог «ниже»');
  if ('error' in alertBelow) return alertBelow;
  const alertAbove = parseNum(str(formData.get('alertAbove')), 'Порог «выше»');
  if ('error' in alertAbove) return alertAbove;
  if (qcMin.value !== null && qcMax.value !== null && qcMin.value > qcMax.value) {
    return { error: 'QC минимум больше QC максимума.' };
  }
  return {
    qcMin: qcMin.value,
    qcMax: qcMax.value,
    changeThreshold: changeThreshold.value,
    cv: cv.value,
    alertBelow: alertBelow.value,
    alertAbove: alertAbove.value,
  };
}

export async function createTest(formData: FormData) {
  const name = str(formData.get('name'));
  if (!name) return { error: 'Укажите название теста.' };
  const code = str(formData.get('code')).toUpperCase();
  if (!code) return { error: 'Укажите код теста.' };
  if (!/^[A-Z0-9_]+$/.test(code))
    return { error: 'Код: только латинские буквы, цифры и «_».' };
  const dup = await prisma.test.findUnique({ where: { code } });
  if (dup) return { error: `Код «${code}» уже используется.` };

  const unit = str(formData.get('unit'));
  if (!unit) return { error: 'Укажите единицу измерения.' };

  const direction = str(formData.get('direction')) || 'HIGHER_IS_BETTER';
  if (!DIRECTIONS.has(direction)) return { error: 'Некорректное направление.' };

  const cat = await resolveCategory(formData);
  if (typeof cat !== 'string') return cat;

  const nums = parseNumericFields(formData);
  if ('error' in nums) return nums;

  await prisma.test.create({
    data: {
      code,
      name,
      unit,
      direction: direction as Direction,
      categoryId: cat,
      isSystem: false,
      createdBy: 'coach',
      qcMin: nums.qcMin,
      qcMax: nums.qcMax,
      qcDescription: str(formData.get('qcDescription')) || null,
      changeThreshold: nums.changeThreshold,
      cv: nums.cv,
      alertBelow: nums.alertBelow,
      alertAbove: nums.alertAbove,
      equipment: str(formData.get('equipment')) || null,
      source: str(formData.get('source')) || null,
      comment: str(formData.get('comment')) || null,
      protocolData: buildProtocol(formData),
    },
  });
  revalidateAll();
  return { ok: true };
}

export async function updateTest(formData: FormData) {
  const id = str(formData.get('id'));
  const test = await prisma.test.findUnique({
    where: { id },
    include: { _count: { select: { testResults: true } } },
  });
  if (!test) return { error: 'Тест не найден.' };
  const hasResults = test._count.testResults > 0;

  const name = str(formData.get('name'));
  if (!name) return { error: 'Укажите название теста.' };
  const unit = str(formData.get('unit'));
  if (!unit) return { error: 'Укажите единицу измерения.' };

  const direction = str(formData.get('direction'));
  if (!DIRECTIONS.has(direction)) return { error: 'Некорректное направление.' };

  if (hasResults && (unit !== test.unit || direction !== test.direction)) {
    if (str(formData.get('confirmed')) !== '1')
      return {
        error: `Для этого теста уже существует ${test._count.testResults} результатов. Изменение единицы или направления повлияет на исторические данные — подтвердите изменение повторно.`,
      };
  }

  const cat = await resolveCategory(formData);
  if (typeof cat !== 'string') return cat;

  const nums = parseNumericFields(formData);
  if ('error' in nums) return nums;

  await prisma.test.update({
    where: { id },
    data: {
      name,
      unit,
      direction: direction as Direction,
      categoryId: cat,
      qcMin: nums.qcMin,
      qcMax: nums.qcMax,
      qcDescription: str(formData.get('qcDescription')) || null,
      changeThreshold: nums.changeThreshold,
      cv: nums.cv,
      alertBelow: nums.alertBelow,
      alertAbove: nums.alertAbove,
      equipment: str(formData.get('equipment')) || null,
      source: str(formData.get('source')) || null,
      comment: str(formData.get('comment')) || null,
      protocolData: buildProtocol(formData),
    },
  });
  revalidateAll();
  return { ok: true };
}

export async function archiveTest(formData: FormData): Promise<void> {
  const id = str(formData.get('id'));
  const test = await prisma.test.findUnique({ where: { id } });
  if (!test) {
    console.error('archiveTest: тест не найден.');
    return;
  }
  await prisma.test.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidateAll();
}