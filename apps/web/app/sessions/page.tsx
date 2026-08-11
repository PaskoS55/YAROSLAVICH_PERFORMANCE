import { prisma } from '../../lib/prisma';
import Link from 'next/link';

const phaseLabels: Record<string, string> = {
  PRESEASON: 'Предсезонка',
  INSEASON: 'Сезон',
  OFFSEASON: 'Межсезонье',
  CAMP: 'Сборы',
  PLAYOFF: 'Плей-офф',
};

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: { q?: string; phase?: string };
}) {
  const q = (searchParams.q ?? '').trim().toLowerCase();
  const phase = searchParams.phase ?? 'ALL';

  const all = await prisma.testSession.findMany({
    where: { deletedAt: null },
    orderBy: { DateTime: 'desc' },
    include: {
      player: { select: { id: true, lastName: true, firstName: true, playerId: true } },
      testResults: { select: { qcStatus: true } },
    },
  });

  const sessions = all.filter((s) => {
    const okPhase = phase === 'ALL' || s.phase === phase;
    const hay = `${s.player.lastName} ${s.player.firstName} ${s.player.playerId} ${s.sessionId}`.toLowerCase();
    return okPhase && (!q || hay.includes(q));
  });

  const phases = Array.from(new Set(all.map((s) => s.phase)));
  const countBy = (ph: string) => all.filter((s) => s.phase === ph).length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Журнал сессий</h1>
        <form className="flex items-center gap-2">
          {phase !== 'ALL' && <input type="hidden" name="phase" value={phase} />}
          <input
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="Игрок или № сессии…"
            className="w-64 rounded border-2 px-3 py-1.5 text-sm"
          />
          <button className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">Найти</button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/sessions${q ? `?q=${encodeURIComponent(q)}` : ''}`}
          className={`rounded-full px-3 py-1 text-sm ${
            phase === 'ALL' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 shadow hover:bg-gray-50'
          }`}
        >
          Все · {all.length}
        </Link>
        {phases.map((ph) => (
          <Link
            key={ph}
            href={`/sessions?phase=${ph}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`rounded-full px-3 py-1 text-sm ${
              phase === ph ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 shadow hover:bg-gray-50'
            }`}
          >
            {phaseLabels[ph] ?? ph} · {countBy(ph)}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">Сессия</th>
              <th className="px-4 py-2 text-left">Дата</th>
              <th className="px-4 py-2 text-left">Игрок</th>
              <th className="px-4 py-2 text-left">Фаза</th>
              <th className="px-4 py-2 text-right">Результатов</th>
              <th className="px-4 py-2 text-left">QC</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sessions.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  Ничего не найдено. Измените фильтр или запрос.
                </td>
              </tr>
            )}
            {sessions.map((s) => {
              const failed = s.testResults.filter((r) => r.qcStatus === 'FAILED').length;
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-mono text-gray-500">{s.sessionId}</td>
                  <td className="px-4 py-3">{fmtDate(s.DateTime)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/players/${s.player.id}`} className="font-medium hover:underline">
                      {s.player.lastName} {s.player.firstName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                      {phaseLabels[s.phase] ?? s.phase}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{s.testResults.length}</td>
                  <td className="px-4 py-3">
                    {failed > 0 ? (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                        ⚠ {failed}
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                        ✓ OK
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/sessions/${s.id}`}
                      className="text-sm hover:underline"
                      style={{ color: 'var(--red)' }}
                    >
                      открыть →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}