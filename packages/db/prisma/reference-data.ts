import type { Direction, Prisma } from '@prisma/client';

export const PRODUCT_CATEGORY_SPECS = [
  ['STRENGTH', 'Сила'], ['POWER', 'Мощность'], ['SPEED', 'Скорость'], ['AGILITY', 'Ловкость'],
  ['MOBILITY_STABILITY', 'Мобильность и стабильность'], ['BODY_COMPOSITION', 'Состав тела'],
] as const;
export const VOLLEYBALL_CATEGORY_SPECS = [['VOLLEYBALL', 'Волейбол']] as const;
export const VOLLEYBALL_POSITIONS = ['outside_hitter', 'opposite', 'middle_blocker', 'setter', 'libero'] as const;

type TestSpec = { code: string; name: string; category: string; direction: Direction; unit: string; qcMin: number; qcMax: number };
export const PRODUCT_TEST_SPECS: readonly TestSpec[] = [
  { code: 'STR_PULL', name: 'Становая тяга', category: 'STRENGTH', direction: 'HIGHER_IS_BETTER', unit: 'kg', qcMin: 80, qcMax: 250 },
  { code: 'STR_SQUAT', name: 'Приседания со штангой', category: 'STRENGTH', direction: 'HIGHER_IS_BETTER', unit: 'kg', qcMin: 60, qcMax: 220 },
  { code: 'PWR_CMJ', name: 'Прыжок вверх (CMJ)', category: 'POWER', direction: 'HIGHER_IS_BETTER', unit: 'cm', qcMin: 20, qcMax: 80 },
  { code: 'PWR_BJ', name: 'Прыжок в длину с места', category: 'POWER', direction: 'HIGHER_IS_BETTER', unit: 'cm', qcMin: 180, qcMax: 320 },
  { code: 'SPD_10', name: 'Спринт 10 м', category: 'SPEED', direction: 'LOWER_IS_BETTER', unit: 'sec', qcMin: 1.4, qcMax: 2.2 },
  { code: 'SPD_20', name: 'Спринт 20 м', category: 'SPEED', direction: 'LOWER_IS_BETTER', unit: 'sec', qcMin: 2.8, qcMax: 4 },
  { code: 'AGI_TTEST', name: 'T-тест', category: 'AGILITY', direction: 'LOWER_IS_BETTER', unit: 'sec', qcMin: 8.5, qcMax: 12 },
  { code: 'AGI_505', name: '505 тест', category: 'AGILITY', direction: 'LOWER_IS_BETTER', unit: 'sec', qcMin: 2, qcMax: 3.5 },
  { code: 'MOB_OHS', name: 'Присед с палкой над головой', category: 'MOBILITY_STABILITY', direction: 'CONTEXTUAL', unit: 'score', qcMin: 0, qcMax: 10 },
  { code: 'MOB_SL', name: 'Выпад в линию', category: 'MOBILITY_STABILITY', direction: 'CONTEXTUAL', unit: 'score', qcMin: 0, qcMax: 10 },
  { code: 'BC_MASS', name: 'Масса тела', category: 'BODY_COMPOSITION', direction: 'CONTEXTUAL', unit: 'kg', qcMin: 60, qcMax: 120 },
  { code: 'BC_FAT', name: 'Процент жира', category: 'BODY_COMPOSITION', direction: 'LOWER_IS_BETTER', unit: '%', qcMin: 5, qcMax: 25 },
  { code: 'BC_FFM', name: 'Безжировая масса', category: 'BODY_COMPOSITION', direction: 'HIGHER_IS_BETTER', unit: 'kg', qcMin: 50, qcMax: 100 },
];
export const VOLLEYBALL_TEST_SPECS: readonly TestSpec[] = [
  { code: 'VB_APP', name: 'Нападающий удар (высота)', category: 'VOLLEYBALL', direction: 'HIGHER_IS_BETTER', unit: 'cm', qcMin: 280, qcMax: 370 },
  { code: 'VB_BLOCK', name: 'Блок (высота)', category: 'VOLLEYBALL', direction: 'HIGHER_IS_BETTER', unit: 'cm', qcMin: 270, qcMax: 350 },
  { code: 'VB_SERVE', name: 'Скорость подачи', category: 'VOLLEYBALL', direction: 'HIGHER_IS_BETTER', unit: 'km/h', qcMin: 70, qcMax: 140 },
];

export async function seedReferenceData(tx: Prisma.TransactionClient) {
  const categoryIds = new Map<string, string>();
  const categories = [...PRODUCT_CATEGORY_SPECS.slice(0, 4), ...VOLLEYBALL_CATEGORY_SPECS, ...PRODUCT_CATEGORY_SPECS.slice(4)];
  for (const [index, [code, name]] of categories.entries()) {
    const category = await tx.testCategory.upsert({ where: { code }, update: { name, sortOrder: index + 1, active: true, includeInRadar: code !== 'BODY_COMPOSITION' }, create: { code, name, sortOrder: index + 1, includeInRadar: code !== 'BODY_COMPOSITION' } });
    categoryIds.set(code, category.id);
  }
  const tests = [];
  const orderedTests = [...PRODUCT_TEST_SPECS.slice(0, 8), ...VOLLEYBALL_TEST_SPECS, ...PRODUCT_TEST_SPECS.slice(8)];
  for (const spec of orderedTests) {
    const data = { name: spec.name, categoryId: categoryIds.get(spec.category)!, direction: spec.direction, unit: spec.unit, qcMin: spec.qcMin, qcMax: spec.qcMax, isSystem: true, deletedAt: null };
    tests.push(await tx.test.upsert({ where: { code: spec.code }, update: data, create: { code: spec.code, ...data } }));
  }
  return { tests };
}
