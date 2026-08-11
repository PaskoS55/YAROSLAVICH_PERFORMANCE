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
  PARTIAL: 'Частичное',
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

  const tests = await prisma.test.findMany({
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
  });

  const results = await prisma.testResult.findMany({
    where: { testSessionId: session.id, deletedAt: null },
  });

  const existing: Record<string, number> = {};
  for (const r of results) existing[r.testId] = r.value;

  const fillPct = Math.round((results.length / Math.max(tests.length, 1)) * 100);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div>
          <Link href="/sessions" className="text-blue-600 hover:underline">Тестирования</Link>
          {' / '}{session.sessionId}
        </div>
        <div>
          Заполнено тестов: <b className="text-gray-900">{results.length}</b> из{' '}
          <b className="text-gray-900">{tests.length}</b>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-white p-6 shadow">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{session.sessionId}</h1>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColors[session.status]}`}>
              {statusLabels[session.status]}
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Дата: <b>{fmtDate(session.DateTime)}</b> · Фаза:{' '}
            <b>{phaseLabels[session.phase] ?? session.phase}</b> · Игрок:{' '}
            <Link href={`/players/${session.player.id}`} className="text-blue-600 hover:underline">
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

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-bold">Ввод результатов</h2>
        <ResultsForm
          sessionId={session.id}
          playerId={session.playerId}
          tests={tests.map((t) => ({
            id: t.id,
            name: t.name,
            unit: t.unit,
            qcMin: t.qcMin,
            qcMax: t.qcMax,
          }))}
          existing={existing}
        />
      </div>
    </div>
  );
}