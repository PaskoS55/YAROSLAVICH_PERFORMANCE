import { prisma } from '../../lib/prisma';
import Link from 'next/link';
import { requireAppContext } from '../../lib/app-context';

const phaseLabels: Record<string, string> = {
  PRESEASON: 'Предсезонка',
  CAMP: 'Сборы',
  INSEASON: 'Сезон',
  POSTSEASON: 'Постсезон',
  RECOVERY: 'Восстановление',
  OFFSEASON: 'Межсезонье',
  PLAYOFF: 'Плей-офф',
};

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; phase?: string }>;
}) {
  const query = await searchParams;
  const context = await requireAppContext();
  const q = (query.q ?? '').trim().toLowerCase();
  const phase = query.phase ?? 'ALL';

  const all = await prisma.testSession.findMany({
    where: { teamId: context.teamId, seasonId: context.seasonId, deletedAt: null },
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
    <div className="space-y-5 p-6">
      <h1 className="text-3xl font-bold">Сессии</h1>

      <form className="relative max-w-xl">
        {phase !== 'ALL' && <input type="hidden" name="phase" value={phase} />}
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          name="q"
          defaultValue={query.q ?? ''}
          placeholder="Поиск по игроку или ID сессии… (Enter)"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm"
        />
      </form>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/sessions${q ? `?q=${encodeURIComponent(q)}` : ''}`}
          className={`rounded-full border px-3 py-1 text-sm ${
            phase === 'ALL'
              ? 'chip-active'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          Все · {all.length}
        </Link>
        {phases.map((ph) => (
          <Link
            key={ph}
            href={`/sessions?phase=${ph}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              phase === ph
                ? 'chip-active'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            {phaseLabels[ph] ?? ph} · {countBy(ph)}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">Игрок</th>
              <th className="whitespace-nowrap px-4 py-2 text-left">Дата</th>
              <th className="px-4 py-2 text-left">Фаза</th>
              <th className="px-4 py-2 text-right">Тестов</th>
              <th className="px-4 py-2 text-left">QC</th>
              <th className="px-4 py-2 text-left">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sessions.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  Ничего не найдено. Измените фильтр или запрос.
                </td>
              </tr>
            )}
            {sessions.map((s) => {
              const failed = s.testResults.filter((r) => r.qcStatus === 'FAILED').length;
              const warn = s.testResults.filter((r) => (r.qcStatus as string) === 'WARN').length;
              return (
                <tr key={s.id} className="relative">
                  <td className="px-4 py-3">
                    <Link
                      href={`/sessions/${s.id}`}
                      className="after:absolute after:inset-0"
                      aria-label={`Открыть сессию ${s.sessionId}`}
                    />
                    <Link
                      href={`/players/${s.player.id}`}
                      className="relative z-10 font-medium hover:underline"
                    >
                      {s.player.lastName} {s.player.firstName}
                    </Link>
                  </td>                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {fmtDate(s.DateTime)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                      {phaseLabels[s.phase] ?? s.phase}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">
                    {s.testResults.length}
                  </td>
                  <td className="px-4 py-3">
                    {failed > 0 ? (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                        ⚠ {failed}
                      </span>
                    ) : warn > 0 ? (
                      <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                        ⚠ {warn}
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                        ✓ OK
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{s.sessionId}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
