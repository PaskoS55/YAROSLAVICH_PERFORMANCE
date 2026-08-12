import { prisma } from '../../lib/prisma';
import NormRow from './norm-row';

const positionLabels: Record<string, string> = {
  outside_hitter: 'Доигровщик',
  opposite: 'Диагональный',
  middle_blocker: 'Центральный',
  setter: 'Связующий',
  libero: 'Либеро',
};

export default async function NormsPage() {
  const tests = await prisma.test.findMany({
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
  });
  const norms = await prisma.norm.findMany({ where: { deletedAt: null } });
  const byTest = new Map<string, typeof norms>();
  for (const n of norms) {
    const arr = byTest.get(n.testCode) ?? [];
    arr.push(n);
    byTest.set(n.testCode, arr);
  }

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-3xl font-bold">Нормативы</h1>
        <p className="mt-1 text-sm text-gray-500">
          Процентильные нормативы по игровым позициям. Используются в «Динамике» и
          «Сравнении».
        </p>
      </div>

      {tests.map((t) => {
        const list = byTest.get(t.code) ?? [];
        if (list.length === 0) return null;
        return (
          <div key={t.id} className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="font-bold">{t.name}</h2>
              <span className="text-xs text-gray-400">
                ({t.code}, {t.unit})
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                {t.direction === 'HIGHER_IS_BETTER'
                  ? '↑ Больше — лучше'
                  : t.direction === 'LOWER_IS_BETTER'
                    ? '↓ Меньше — лучше'
                    : '· Контекстно'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[1.2fr_repeat(5,5.5rem)_9rem] gap-2 border-b border-gray-200 pb-1 text-xs text-gray-500">
                  <div>Позиция</div>
                  <div>p10</div>
                  <div>p25</div>
                  <div>p50</div>
                  <div>p75</div>
                  <div>p90</div>
                  <div></div>
                </div>
                {list.map((n) => (
                  <NormRow
                    key={n.id}
                    positionLabel={positionLabels[n.position] ?? n.position}
                    norm={{
                      id: n.id,
                      position: n.position,
                      anchor10: n.anchor10,
                      anchor25: n.anchor25,
                      anchor50: n.anchor50,
                      anchor75: n.anchor75,
                      anchor90: n.anchor90,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}