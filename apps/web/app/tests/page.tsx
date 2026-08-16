import { prisma } from '../../lib/prisma';
import Link from 'next/link';
import CategoryManager from './category-manager';

const directionLabels: Record<string, string> = {
  HIGHER_IS_BETTER: '↑ больше — лучше',
  LOWER_IS_BETTER: '↓ меньше — лучше',
  CONTEXTUAL: '· контекстное',
};

export default async function TestsPage({
  searchParams,
}: {
  searchParams: { archived?: string };
}) {
  const showArchived = searchParams.archived === '1';
  const tests = await prisma.test.findMany({
    where: showArchived ? { NOT: { deletedAt: null } } : { deletedAt: null },
    orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
    include: {
      categoryRel: true,
      _count: {
        select: {
          testResults: true,
          norms: { where: { deletedAt: null } },
        },
      },
    },
  });

  const categories = await prisma.testCategory.findMany({
    orderBy: [{ radarOrder: 'asc' }, { sortOrder: 'asc' }],
  });

  const base = tests.filter((t) => t.isSystem);
  const custom = tests.filter((t) => !t.isSystem);

  const row = (t: (typeof tests)[number]) => (
    <tr key={t.id} className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <Link href={`/tests/${t.id}`} className="font-medium hover:underline">
          {t.name}
        </Link>
        <div className="font-mono text-xs text-gray-400">{t.code}</div>
      </td>
      <td className="px-4 py-3 text-gray-600">{t.categoryRel?.name ?? '—'}</td>
      <td className="px-4 py-3 text-gray-600">{t.unit}</td>
      <td className="px-4 py-3 text-gray-600">{directionLabels[t.direction]}</td>
      <td className="px-4 py-3 text-right font-mono text-gray-600">{t._count.testResults}</td>
      <td className="px-4 py-3">
        {t._count.norms > 0 ? (
          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
            настроены
          </span>
        ) : (
          <Link
            href="/norms"
            className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 hover:underline"
            title="Процентили для этого теста не настроены"
          >
            не настроены →
          </Link>
        )}
      </td>
      <td className="px-4 py-3">
        {t.deletedAt ? (
          <span className="rounded-full bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-600">
            Архив
          </span>
        ) : (
          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
            Активен
          </span>
        )}
      </td>
    </tr>
  );

  const head = (
    <tr>
      <th className="px-4 py-2 text-left">Тест</th>
      <th className="px-4 py-2 text-left">Категория</th>
      <th className="px-4 py-2 text-left">Ед.</th>
      <th className="px-4 py-2 text-left">Направление</th>
      <th className="px-4 py-2 text-right">Результатов</th>
      <th className="px-4 py-2 text-left">Нормативы</th>
      <th className="px-4 py-2 text-left">Статус</th>
    </tr>
  );

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Тесты</h1>
          <p className="mt-1 text-sm text-gray-500">
            Каталог тестов команды: методика, QC-правила и интерпретация.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={showArchived ? '/tests' : '/tests?archived=1'}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            {showArchived ? 'Скрыть архивные' : 'Показать архивные'}
          </a>
          <Link href="/tests/new" className="btn-primary">
            + Добавить тест
          </Link>
        </div>
      </div>

      {custom.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">
            Добавленные командой
          </div>
          <table className="min-w-full text-sm">
            <thead>{head}</thead>
            <tbody className="divide-y divide-gray-200">{custom.map(row)}</tbody>
          </table>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">
          Базовые тесты
        </div>
        <table className="min-w-full text-sm">
          <thead>{head}</thead>
          <tbody className="divide-y divide-gray-200">{base.map(row)}</tbody>
        </table>
      </div>

      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          includeInRadar: c.includeInRadar,
          radarOrder: c.radarOrder,
        }))}
      />
    </div>
  );
}