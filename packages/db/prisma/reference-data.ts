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
  { code: 'BC_FAT', name: 'Процент жира', category: 'BODY_COMPOSITION', direction: 'CONTEXTUAL', unit: '%', qcMin: 5, qcMax: 25 },
  { code: 'BC_FFM', name: 'Безжировая масса', category: 'BODY_COMPOSITION', direction: 'CONTEXTUAL', unit: 'kg', qcMin: 50, qcMax: 100 },
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
  await seedPaskoReferenceV1(tx, new Map(tests.map((test) => [test.code, test.id])));
  return { tests };
}

export const PASKO_REFERENCE_V1_CODE = 'PASKO_VOLLEYBALL_MEN_ELITE_V1';

const SYSTEM_SOURCES = [
  {
    code: 'PALAO_2014_ELITE_REACH', title: 'Anthropometric, physical, and age differences by the player position and the performance level in volleyball',
    authors: 'José M. Palao; Policarpo Manzanares; David Valadés', year: 2014, journal: 'Journal of Human Kinetics',
    doi: '10.2478/hukin-2014-0128', pmid: '25713683', sourceType: 'PEER_REVIEWED_ARTICLE' as const,
    notes: 'Мужчины международного уровня, команды 1–4 мест Олимпийских игр и чемпионатов мира 2000–2012.',
  },
  {
    code: 'KOZINC_2021_MALE_VOLLEYBALL', title: 'Questionable Utility of the Eccentric Utilization Ratio in Relation to the Performance of Volleyball Players',
    authors: 'Žiga Kozinc; Jernej Pleša; Nejc Šarabon', year: 2021, journal: 'International Journal of Environmental Research and Public Health 18(22):11754',
    doi: '10.3390/ijerph182211754', pmid: '34831507', sourceType: 'PEER_REVIEWED_ARTICLE' as const,
    notes: '45 молодых мужчин-волейболистов, 1–2 национальный дивизион.',
  },
  {
    code: 'CIN_2021_PRO_VOLLEYBALL', title: 'Cluster Resistance Training Results Higher Improvements on Sprint, Agility, Strength and Vertical Jump in Professional Volleyball Players',
    authors: 'Merve Cin; Refik Çabuk; Onur Demirarar; Bahtiyar Özçaldıran', year: 2021, journal: 'Turkiye Klinikleri Journal of Sports Sciences 13(2):234–240',
    doi: '10.5336/sportsci.2020-79052', pmid: null, sourceType: 'PEER_REVIEWED_ARTICLE' as const,
    notes: '28 профессиональных мужчин; PASKO объединяет только опубликованные pre-test значения двух равных групп n=14.',
  },
  {
    code: 'MATLOSZ_2023_BODY_FAT', title: 'Body fat of competitive volleyball players: a systematic review with meta-analysis',
    authors: 'Piotr Matłosz et al.', year: 2023, journal: 'Journal of the International Society of Sports Nutrition',
    doi: '10.1080/15502783.2023.2246414', pmid: '37578094', sourceType: 'META_ANALYSIS' as const,
    notes: '63 исследования, 2607 игроков. CI относится к pooled mean и не является диапазоном нормы спортсмена.',
  },
] as const;

type EntrySeed = {
  testCode: string; position?: string; interpretationType: 'PUBLISHED_DISTRIBUTION' | 'POOLED_ESTIMATE' | 'CONTEXT_ONLY' | 'NO_REFERENCE';
  evidenceLevel: 'HIGH' | 'MODERATE' | 'LOW' | 'NOT_APPLICABLE'; sourceCode?: string; mean?: number; sd?: number;
  ciLow?: number; ciHigh?: number; sampleSize?: number; evidenceScope?: string; protocolText?: string;
  measurementMethod?: string; notes?: string; derivedByPasko?: boolean; derivedApproximate?: boolean;
};

const contextual = (testCode: string, notes: string): EntrySeed => ({ testCode, interpretationType: 'CONTEXT_ONLY', evidenceLevel: 'NOT_APPLICABLE', notes });
const unavailable = (testCode: string, notes: string): EntrySeed => ({ testCode, interpretationType: 'NO_REFERENCE', evidenceLevel: 'NOT_APPLICABLE', notes });

export const PASKO_REFERENCE_V1_ENTRIES: readonly EntrySeed[] = [
  unavailable('STR_PULL', 'Системный референс пока не утверждён.'),
  contextual('STR_SQUAT', 'Для корректной интерпретации силовых показателей требуется относительное значение и единый протокол.'),
  { testCode: 'PWR_CMJ', interpretationType: 'PUBLISHED_DISTRIBUTION', evidenceLevel: 'MODERATE', mean: 42, sd: 6, sampleSize: 45, sourceCode: 'KOZINC_2021_MALE_VOLLEYBALL', evidenceScope: 'Мужчины · 1–2 национальный дивизион', protocolText: 'Сравнение ориентировочное — проверьте совместимость протокола.' },
  unavailable('PWR_BJ', 'Системный референс пока не утверждён: недостаточно протокол-совместимых данных.'),
  { testCode: 'SPD_10', interpretationType: 'PUBLISHED_DISTRIBUTION', evidenceLevel: 'LOW', mean: 1.73, sd: 0.09, sampleSize: 28, sourceCode: 'CIN_2021_PRO_VOLLEYBALL', derivedByPasko: true, derivedApproximate: true, notes: 'Приближённо объединено PASKO из pre-test 1,73±0,08 и 1,73±0,11, n=14+14.' },
  { testCode: 'SPD_20', interpretationType: 'PUBLISHED_DISTRIBUTION', evidenceLevel: 'LOW', mean: 3.07, sd: 0.15, sampleSize: 28, sourceCode: 'CIN_2021_PRO_VOLLEYBALL', derivedByPasko: true, derivedApproximate: true, notes: 'Приближённо объединено PASKO из pre-test 2,98±0,10 и 3,15±0,14, n=14+14.' },
  { testCode: 'AGI_TTEST', interpretationType: 'PUBLISHED_DISTRIBUTION', evidenceLevel: 'LOW', mean: 10.12, sd: 0.27, sampleSize: 28, sourceCode: 'CIN_2021_PRO_VOLLEYBALL', derivedByPasko: true, derivedApproximate: true, protocolText: 'Сравнение ориентировочное — проверьте совместимость протокола.', notes: 'Приближённо объединено PASKO из pre-test 10,07±0,28 и 10,16±0,27, n=14+14.' },
  unavailable('AGI_505', 'Системный референс пока не утверждён.'),
  contextual('MOB_OHS', 'Текущая шкала PASKO 0–10 не является автоматически эквивалентной шкале FMS.'),
  contextual('MOB_SL', 'Текущая шкала PASKO 0–10 не является автоматически эквивалентной шкале FMS.'),
  contextual('BC_MASS', 'Масса тела интерпретируется только в контексте роста, позиции и индивидуальной морфологии.'),
  { testCode: 'BC_FAT', interpretationType: 'POOLED_ESTIMATE', evidenceLevel: 'MODERATE', mean: 12.8, ciLow: 11.9, ciHigh: 13.8, sourceCode: 'MATLOSZ_2023_BODY_FAT', evidenceScope: 'Мужчины-волейболисты разных соревновательных уровней и методов измерения', measurementMethod: 'Результаты существенно зависят от метода измерения.', notes: '95% CI относится к обобщённому среднему литературы, а не к индивидуальному диапазону нормы.' },
  contextual('BC_FFM', 'Безжировая масса требует индивидуального и позиционного контекста; больше не всегда означает лучше.'),
  contextual('VB_SERVE', 'Для системного сравнения необходимо указать тип подачи.'),
  ...([['setter',337,10],['middle_blocker',349,14],['outside_hitter',345,10],['opposite',350,8],['libero',329,12],[undefined,344,13]] as const).map(([position, mean, sd]) => ({ testCode: 'VB_APP', position, interpretationType: 'PUBLISHED_DISTRIBUTION' as const, evidenceLevel: 'HIGH' as const, mean, sd, sourceCode: 'PALAO_2014_ELITE_REACH', evidenceScope: 'Мужчины международного уровня · команды 1–4 мест' })),
  ...([['setter',318,9],['middle_blocker',330,8],['outside_hitter',326,11],['opposite',332,9],['libero',312,11],[undefined,325,11]] as const).map(([position, mean, sd]) => ({ testCode: 'VB_BLOCK', position, interpretationType: 'PUBLISHED_DISTRIBUTION' as const, evidenceLevel: 'HIGH' as const, mean, sd, sourceCode: 'PALAO_2014_ELITE_REACH', evidenceScope: 'Мужчины международного уровня · команды 1–4 мест' })),
];

async function seedPaskoReferenceV1(tx: Prisma.TransactionClient, testIds: Map<string, string>) {
  const profile = await tx.normProfile.upsert({
    where: { code: PASKO_REFERENCE_V1_CODE }, update: {},
    create: { code: PASKO_REFERENCE_V1_CODE, name: 'PASKO Reference — Мужчины / Элитный волейбол', sport: 'VOLLEYBALL', sex: 'MALE', level: 'ELITE', ageGroup: 'ADULT', version: '1.0', scope: 'SYSTEM', status: 'ACTIVE', isDefaultForVertical: true },
  });
  const sourceIds = new Map<string, string>();
  for (const source of SYSTEM_SOURCES) {
    const row = await tx.referenceSource.upsert({ where: { code: source.code }, update: {}, create: source });
    sourceIds.set(source.code, row.id);
  }
  for (const spec of PASKO_REFERENCE_V1_ENTRIES) {
    const testId = testIds.get(spec.testCode);
    if (!testId) throw new Error(`Missing system Test for reference entry: ${spec.testCode}`);
    const existing = await tx.normEntry.findFirst({ where: { profileId: profile.id, testId, position: spec.position ?? null } });
    const entry = existing ?? await tx.normEntry.create({ data: { profileId: profile.id, testId, position: spec.position ?? null, interpretationType: spec.interpretationType, evidenceLevel: spec.evidenceLevel, mean: spec.mean, sd: spec.sd, ciLow: spec.ciLow, ciHigh: spec.ciHigh, sampleSize: spec.sampleSize, evidenceScope: spec.evidenceScope, protocolText: spec.protocolText, measurementMethod: spec.measurementMethod, notes: spec.notes, derivedByPasko: spec.derivedByPasko ?? false, derivedApproximate: spec.derivedApproximate ?? false } });
    if (spec.sourceCode) await tx.normEntrySource.upsert({ where: { entryId_sourceId: { entryId: entry.id, sourceId: sourceIds.get(spec.sourceCode)! } }, update: {}, create: { entryId: entry.id, sourceId: sourceIds.get(spec.sourceCode)! } });
  }
}
