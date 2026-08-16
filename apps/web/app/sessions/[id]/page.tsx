import { prisma } from '../../../lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ResultsForm from './results-form';

const phaseLabels: Record<string, string> = {
  PRESEASON: 'Предсезонка',
  CAMP: 'Сборы',
  INSEASON: 'Сезон',
  POSTSEASON: 'Постсезон',
  RECOVERY: 'Восстановление',
};

const statusLabels: Record<string, string> = {
  FULL: 'Полное',
  PARTIAL: 'Частично',
  INCOMPLETE: 'Не завершено',
  RESTRICTED: 'Ограничение',
};

const statusColors: Record<string, string> = {
  FULL: 'bg-green-100 text-green-800',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
  INCOMPLETE: 'bg-gray-100 text-gray-800',
  RESTRICTED: 'bg-red-100 text-red-800',
};

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

export default async function SessionPage({ params }: { params: { id: string } }) {
  const session = await prisma.testSession.findUnique({
    where: { id: params.id },
    include: { player: true },
  });

  if (!session || session.deletedAt) notFound();

  const activeTests = await prisma.test.findMany({
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
  });

  const results = await prisma.testResult.findMany({
    where: { testSessionId: session.id, deletedAt: null },
    include: { test: true },
  });

  const existing: Record<string, number> = {};
  for (const r of results) existing[r.testId] = r.value;

  // Историческая целостность: активные тесты + архивные, по которым в сессии есть результат
  const byId = new Map<
    string,
    {
      id: string;
      name: string;
      unit: string;
      qcMin: number | null;
      qcMax: number | null;
      archived: boolean;
    }
  >();
  for (const t of activeTests) {
    byId.set(t.id, {
      id: t.id,
      name: t.name,
      unit: t.unit,
      qcMin: t.qcMin,
      qcMax: t.qcMax,
      archived: false,
    });
  }
  for (const r of results) {
    if (!byId.has(r.testId)) {
      byId.set(r.testId, {
        id: r.test.id,
        name: r.test.name,
        unit: r.test.unit,
        qcMin: r.test.qcMin,
        qcMax: r.test.qcMax,
        archived: true,
      });
    }
  }
  const rows = [...byId.values()];
  const fillPct = Math.min(100, Math.round((results.length / Math.max(rows.length, 1)) * 100));

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
        <div>
          <Link href="/sessions" className="font-medium hover:underline">
            Тестирования
          </Link>{' '}
          / {session.sessionId}
        </div>
        <div>
          Заполнено тестов: <b className="text-gray-900">{results.length}</b> из{' '}
          <b className="text-gray-900">{rows.length}</b>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{session.sessionId}</h1>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColors[session.status]}`}
            >
              {statusLabels[session.status]}
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Дата: <b>{fmtDate(session.DateTime)}</b> · Фаза:{' '}
            <b>{phaseLabels[session.phase] ?? session.phase}</b> · Игрок:{' '}
            <Link
              href={`/players/${session.player.id}`}
              className="font-medium text-gray-900 hover:underline"
            >
              {session.player.lastName} {session.player.firstName}
            </Link>
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 px-5 py-3 text-center">
          <div className="text-2xl font-extrabold" style={{ color: 'var(--red)' }}>
            {fillPct}%
          </div>
          <div className="text-xs text-gray-500">заполнено</div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-bold">Ввод результатов</h2>
        <ResultsForm sessionId={session.id} tests={rows} existing={existing} />
      </div>
    </div>
  );
}