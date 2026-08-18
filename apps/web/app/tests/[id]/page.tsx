import { prisma } from '../../../lib/prisma';
import { notFound } from 'next/navigation';
import TestEditor, { ArchiveButton } from '../test-editor';
import { archiveTest } from '../actions';

export default async function EditTestPage({ params }: { params: { id: string } }) {
  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: { _count: { select: { testResults: true } } },
  });
  if (!test) notFound();

  const categories = await prisma.testCategory.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });

  let protocol = { how: '', result: '', rules: [] as string[] };
  if (test.protocolData) {
    try {
      const p = JSON.parse(test.protocolData);
      protocol = {
        how: p.how ?? '',
        result: p.result ?? '',
        rules: Array.isArray(p.rules) ? p.rules : [],
      };
    } catch {}
  }

  const resultsCount = test._count.testResults;

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{test.name}</h1>
          <p className="mt-1 font-mono text-sm text-gray-400">{test.code}</p>
        </div>
        {!test.deletedAt && (
          <form action={archiveTest}>
            <input type="hidden" name="id" value={test.id} />
            <ArchiveButton />
          </form>
        )}
      </div>
      <TestEditor
        test={{
          id: test.id,
          code: test.code,
          name: test.name,
          unit: test.unit,
          direction: test.direction,
          categoryId: test.categoryId,
          qcMin: test.qcMin,
          qcMax: test.qcMax,
          qcDescription: test.qcDescription,
          changeThreshold: test.changeThreshold,
          cv: test.cv,
          alertBelow: test.alertBelow,
          alertAbove: test.alertAbove,
          equipment: test.equipment,
          source: test.source,
          comment: test.comment,
          protocol,
        }}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        hasResults={resultsCount > 0}
        resultsCount={resultsCount}
      />
    </div>
  );
}