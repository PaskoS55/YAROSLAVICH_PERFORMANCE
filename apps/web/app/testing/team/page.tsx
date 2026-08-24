import { prisma } from '../../../lib/prisma';
import TeamForm from './team-form';
import { requireAppContext } from '../../../lib/app-context';

export default async function TeamTestingPage() {
  const context = await requireAppContext();
  const players = await prisma.player.findMany({
    where: { teamId: context.teamId, deletedAt: null, status: 'ACTIVE' },
    orderBy: { playerId: 'asc' },
  });

  const tests = await prisma.test.findMany({
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
  });

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-3xl font-bold">Провести тестирование</h1>
        <p className="mt-1 text-sm text-gray-500">
          Один тест · вся команда · одна дата. Пустое поле = игрок не
          тестировался. Сессия создаётся автоматически.
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <TeamForm
          players={players.map((p) => ({
            id: p.id,
            playerId: p.playerId,
            lastName: p.lastName,
            firstName: p.firstName,
          }))}
          tests={tests.map((t) => ({
            id: t.id,
            code: t.code,
            name: t.name,
            unit: t.unit,
            qcMin: t.qcMin,
            qcMax: t.qcMax,
          }))}
        />
      </div>
    </div>
  );
}
