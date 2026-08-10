import { prisma } from '../../../lib/prisma';
import TeamForm from './team-form';

export default async function TeamTestingPage() {
  const players = await prisma.player.findMany({
    where: { deletedAt: null, status: 'ACTIVE' },
    orderBy: { playerId: 'asc' },
  });

  const tests = await prisma.test.findMany({
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
  });

  return (
    <div className="p-6">
      <h1 className="mb-2 text-3xl font-bold">Командный ввод</h1>
      <p className="mb-6 text-sm text-gray-500">
        Ввод результатов одного теста для всех активных игроков за одну дату.
        Пустое поле = игрок не тестировался. Сессия создаётся автоматически.
      </p>
      <div className="bg-white rounded-lg shadow p-6">
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
