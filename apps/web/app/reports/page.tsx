import { prisma } from '../../lib/prisma';
import ReportsCards from './reports-cards';

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

export default async function ReportsPage() {
  const sessions = await prisma.testSession.findMany({
    where: { deletedAt: null },
    orderBy: { DateTime: 'desc' },
    include: { player: { select: { lastName: true, firstName: true } } },
  });

  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    orderBy: { lastName: 'asc' },
  });

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-3xl font-bold">Отчёты</h1>
        <p className="mt-1 text-sm text-gray-500">
          Экспорт командных, индивидуальных и сессионных данных.
        </p>
      </div>

      <ReportsCards
        players={players.map((p) => ({
          id: p.id,
          lastName: p.lastName,
          firstName: p.firstName,
          playerId: p.playerId,
        }))}
        sessions={sessions.map((s) => ({
          id: s.id,
          sessionId: s.sessionId,
          date: fmtDate(s.DateTime),
          playerLabel: `${s.player.lastName} ${s.player.firstName}`,
        }))}
      />

      <p className="text-xs text-gray-500">
        Формат: CSV · UTF-8 · совместим с Excel.
      </p>
    </div>
  );
}