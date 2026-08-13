import { prisma } from '../../lib/prisma';
import ProtocolsList from './protocols-list';

export default async function ProtocolsPage() {
  const tests = await prisma.test.findMany({
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
  });

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-3xl font-bold">Протоколы</h1>
        <p className="mt-1 text-sm text-gray-500">
          Методика выполнения, критерии оценки и правила зачёта каждого теста.
        </p>
      </div>
      <ProtocolsList
        tests={tests.map((t) => ({
          id: t.id,
          code: t.code,
          name: t.name,
          category: t.category,
          direction: t.direction,
          unit: t.unit,
          qcMin: t.qcMin,
          qcMax: t.qcMax,
          changeThreshold: t.changeThreshold,
        }))}
      />
    </div>
  );
}