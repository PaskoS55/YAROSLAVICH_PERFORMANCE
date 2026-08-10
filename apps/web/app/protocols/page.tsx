import { prisma } from '../../lib/prisma';

const categoryLabels: Record<string, string> = {
  STRENGTH: 'Сила',
  POWER: 'Мощность',
  SPEED: 'Скорость',
  AGILITY: 'Ловкость',
  VOLLEYBALL: 'Волейбол',
  MOBILITY_STABILITY: 'Мобильность',
  BODY_COMPOSITION: 'Состав тела',
};

const directionLabels: Record<string, string> = {
  HIGHER_IS_BETTER: 'выше — лучше',
  LOWER_IS_BETTER: 'ниже — лучше',
  CONTEXTUAL: 'контекстное',
};

export default async function ProtocolsPage() {
  const tests = await prisma.test.findMany({
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
  });

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Протоколы и QC-правила</h1>
      <p className="text-sm text-gray-500">
        Справочник тестов: категория, направление, единицы и допустимые QC-диапазоны.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {tests.map((t) => (
          <div key={t.id} className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{t.name}</h2>
              <span className="text-xs text-gray-400">{t.code}</span>
            </div>
            <div className="mt-2 space-y-1 text-sm text-gray-600">
              <div>Категория: <b>{categoryLabels[t.category] ?? t.category}</b></div>
              <div>Направление: <b>{directionLabels[t.direction]}</b></div>
              <div>Единицы: <b>{t.unit}</b></div>
              <div>QC-диапазон: <b>{t.qcMin ?? '…'} – {t.qcMax ?? '…'}</b></div>
              {t.changeThreshold !== null && (
                <div>Порог значимости (MDC): <b>{t.changeThreshold}</b></div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}