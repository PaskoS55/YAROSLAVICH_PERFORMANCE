'use server';
import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';
const str = (v: FormDataEntryValue | null) => String(v ?? '').trim();
const numOrNull = (s: string) => {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
function revalidateAll() {
  revalidatePath('/tests', 'layout');
  revalidatePath('/protocols');
  revalidatePath('/testing', 'layout');
  revalidatePath('/norms');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/compare');
  revalidatePath('/goals', 'layout');
}
async function resolveCategory(formData: FormData): Promise<string | { error: string }> {
  let categoryId = str(formData.get('categoryId'));
  const newCat = str(formData.get('newCategory'));
  if (categoryId === '__new__') {
    if (!newCat) return { error: 'Укажите название новой категории.' };
    const catCode = 'CUSTOM_' + newCat.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const existing = await prisma.testCategory.findUnique({ where: { code: catCode } });
    categoryId = existing ? existing.id : (await prisma.testCategory.create({ data: { code: catCode, name: newCat, sortOrder: 100 } })).id;
  }
  if (!categoryId) return { error: 'Выберите категорию.' };
  return categoryId;
}
function buildProtocol(formData: FormData) {
  const rules = formData.getAll('rules').map((r) => str(r)).filter(Boolean);
  return JSON.stringify({ how: str(formData.get('how')), result: str(formData.get('result')), rules });
}
export async function createTest(formData: FormData) {
  const name = str(formData.get('name'));
  if (!name) return { error: 'Укажите название теста.' };
  const code = str(formData.get('code')).toUpperCase();
  if (!code) return { error: 'Укажите код теста.' };
  if (!/^[A-Z0-9_]+$/.test(code)) return { error: 'Код: только латинские буквы, цифры и «_».' };
  const dup = await prisma.test.findUnique({ where: { code } });
  if (dup) return { error: `Код «${code}» уже используется.` };
  const unit = str(formData.get('unit'));
  if (!unit) return { error: 'Укажите единицу измерения.' };
  const cat = await resolveCategory(formData);
  if (typeof cat !== 'string') return cat;
  const qcMin = numOrNull(str(formData.get('qcMin')));
  const qcMax = numOrNull(str(formData.get('qcMax')));
  if (qcMin !== null && qcMax !== null && qcMin > qcMax) return { error: 'QC минимум больше QC максимума.' };
  await prisma.test.create({
    data: {
      code, name, unit,
      direction: str(formData.get('direction')) || 'HIGHER_IS_BETTER',
      categoryId: cat, isSystem: false, createdBy: 'coach',
      qcMin, qcMax, qcDescription: str(formData.get('qcDescription')) || null,
      changeThreshold: numOrNull(str(formData.get('changeThreshold'))),
      cv: numOrNull(str(formData.get('cv'))),
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
  const test = await prisma.test.findUnique({ where: { id }, include: { _count: { select: { testResults: true } } } });
  if (!test) return { error: 'Тест не найден.' };
  const hasResults = test._count.testResults > 0;
  const name = str(formData.get('name'));
  if (!name) return { error: 'Укажите название теста.' };
  const unit = str(formData.get('unit'));
  if (!unit) return { error: 'Укажите единицу измерения.' };
  const direction = str(formData.get('direction'));
  if (hasResults && (unit !== test.unit || direction !== test.direction)) {
    if (str(formData.get('confirmed')) !== '1')
      return { error: `Для этого теста уже существует ${test._count.testResults} результатов. Изменение единицы или направления повлияет на исторические данные — подтвердите изменение повторно.` };
  }
  const cat = await resolveCategory(formData);
  if (typeof cat !== 'string') return cat;
  const qcMin = numOrNull(str(formData.get('qcMin')));
  const qcMax = numOrNull(str(formData.get('qcMax')));
  if (qcMin !== null && qcMax !== null && qcMin > qcMax) return { error: 'QC минимум больше QC максимума.' };
  await prisma.test.update({
    where: { id },
    data: {
      name, unit, direction, categoryId: cat,
      qcMin, qcMax, qcDescription: str(formData.get('qcDescription')) || null,
      changeThreshold: numOrNull(str(formData.get('changeThreshold'))),
      cv: numOrNull(str(formData.get('cv'))),
      equipment: str(formData.get('equipment')) || null,
      source: str(formData.get('source')) || null,
      comment: str(formData.get('comment')) || null,
      protocolData: buildProtocol(formData),
    },
  });
  revalidateAll();
  return { ok: true };
}
export async function archiveTest(formData: FormData) {
  const id = str(formData.get('id'));
  const test = await prisma.test.findUnique({ where: { id } });
  if (!test) return { error: 'Тест не найден.' };
  await prisma.test.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidateAll();
  return { ok: true };
}
