import { prisma } from '../../../lib/prisma';
import TestEditor from '../test-editor';
export default async function NewTestPage() {
  const categories = await prisma.testCategory.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
  return (
    <div className="space-y-5 p-6">
      <div><h1 className="text-3xl font-bold">Новый тест</h1>
        <p className="mt-1 text-sm text-gray-500">После сохранения тест сразу появится в тестировании, аналитике, протоколах и импорте.</p>
      </div>
      <TestEditor test={null} categories={categories.map((c) => ({ id: c.id, name: c.name }))} hasResults={false} resultsCount={0} />
    </div>
  );
}
