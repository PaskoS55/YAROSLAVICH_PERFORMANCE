import { prisma } from '../../lib/prisma';
import { updateNorm } from './actions';

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

  const grid = 'grid grid-cols-[1.4fr_repeat(5,5.5rem)_5rem] gap-2 items-center';

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Нормативы</h1>
        <p className="mt-1 text-sm text-gray-500">
          Процентильные якоря по позициям. Изменения сразу влияют на «Динамику»,
          «Сравнение» и «Графики».
        </p>
      </div>

      {tests.map((t) => {
        const list = byTest.get(t.code) ?? [];
        if (list.length === 0) return null;
        return (
          <div key={t.id} className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-3 font-bold">
              {t.name}{' '}
              <span className="text-xs font-normal text-gray-400">
                ({t.code}, {t.unit})
              </span>
            </h2>
            <div className={`${grid} border-b pb-1 text-xs text-gray-500`}>
              <div>Позиция</div>
              <div>p10</div>
              <div>p25</div>
              <div>p50</div>
              <div>p75</div>
              <div>p90</div>
              <div></div>
            </div>
            {list.map((n) => (
              <form
                key={n.id}
                action={updateNorm}
                className={`${grid} border-b py-2 last:border-0`}
              >
                <input type="hidden" name="id" value={n.id} />
                <div className="text-sm">{positionLabels[n.position] ?? n.position}</div>
                {(['anchor10', 'anchor25', 'anchor50', 'anchor75', 'anchor90'] as const).map(
                  (f) => (
                    <input
                      key={f}
                      name={f}
                      defaultValue={String(n[f]).replace('.', ',')}
                      className="w-full rounded border px-1 py-0.5 font-mono text-sm"
                    />
                  )
                )}
                <button className="text-sm text-blue-600 hover:underline">Сохранить</button>
              </form>
            ))}
          </div>
        );
      })}
    </div>
  );
}