import { prisma } from '../../../../lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updatePlayer, archivePlayer, restorePlayer } from './actions';
import ArchiveButton from './archive-button';

function fmtDateInput(d: Date | null | undefined) {
  if (!d) return '';
  return new Date(d).toISOString().split('T')[0];
}

export default async function EditPlayerPage({ params }: { params: { id: string } }) {
  const player = await prisma.player.findUnique({ where: { id: params.id } });
  if (!player) notFound();

  return (
    <div className="space-y-6 p-6">
      <div className="text-sm text-gray-500">
        <Link href="/players" className="text-blue-600 hover:underline">Игроки</Link>
        {' / '}
        <Link href={`/players/${player.id}`} className="text-blue-600 hover:underline">
          {player.playerId}
        </Link>
        {' / Редактирование'}
      </div>

      {player.deletedAt && (
        <div className="rounded-lg border-2 border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-yellow-900">
              Игрок в архиве с {new Date(player.deletedAt).toLocaleDateString('ru-RU')}.
            </p>
            <form action={restorePlayer}>
              <input type="hidden" name="id" value={player.id} />
              <button className="rounded bg-yellow-600 px-3 py-1 text-sm text-white hover:bg-yellow-700">
                Вернуть из архива
              </button>
            </form>
          </div>
        </div>
      )}

      <h1 className="text-3xl font-bold">
        {player.lastName} {player.firstName} — редактирование
      </h1>

      <form
        action={updatePlayer}
        className="grid grid-cols-1 gap-4 rounded-lg bg-white p-6 shadow md:grid-cols-3"
      >
        <input type="hidden" name="id" value={player.id} />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">ID игрока *</label>
          <input
            name="playerId"
            defaultValue={player.playerId}
            required
            className="w-full rounded border-2 border-gray-300 px-2 py-1 font-mono"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Фамилия *</label>
          <input
            name="lastName"
            defaultValue={player.lastName}
            required
            className="w-full rounded border-2 border-gray-300 px-2 py-1"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Имя *</label>
          <input
            name="firstName"
            defaultValue={player.firstName}
            required
            className="w-full rounded border-2 border-gray-300 px-2 py-1"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Отчество</label>
          <input
            name="middleName"
            defaultValue={player.middleName ?? ''}
            className="w-full rounded border-2 border-gray-300 px-2 py-1"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Амплуа *</label>
          <select
            name="position"
            defaultValue={player.position}
            className="w-full rounded border-2 border-gray-300 px-2 py-1"
          >
            <option value="outside_hitter">Доигровщик</option>
            <option value="opposite">Диагональный</option>
            <option value="middle_blocker">Центральный блокирующий</option>
            <option value="setter">Связующий</option>
            <option value="libero">Либеро</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Статус</label>
          <select
            name="status"
            defaultValue={player.status}
            className="w-full rounded border-2 border-gray-300 px-2 py-1"
          >
            <option value="ACTIVE">Активен</option>
            <option value="LIMITED">Ограничение</option>
            <option value="INJURED">Травмирован</option>
            <option value="INACTIVE">Неактивен</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">№ на форме</label>
          <input
            name="number"
            type="number"
            min="1"
            max="99"
            defaultValue={player.number ?? ''}
            className="w-full rounded border-2 border-gray-300 px-2 py-1"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Рост (см)</label>
          <input
            name="height"
            type="number"
            min="150"
            max="220"
            defaultValue={player.height ?? ''}
            className="w-full rounded border-2 border-gray-300 px-2 py-1"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Дата рождения</label>
          <input
            name="birthDate"
            type="date"
            defaultValue={fmtDateInput(player.birthDate)}
            className="w-full rounded border-2 border-gray-300 px-2 py-1"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Зачислен в команду</label>
          <input
            name="joinedDate"
            type="date"
            defaultValue={fmtDateInput(player.joinedDate)}
            className="w-full rounded border-2 border-gray-300 px-2 py-1"
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Комментарий</label>
          <textarea
            name="comment"
            defaultValue={player.comment ?? ''}
            rows={2}
            className="w-full rounded border-2 border-gray-300 px-2 py-1"
          />
        </div>
        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Сохранить
          </button>
          <Link
            href={`/players/${player.id}`}
            className="rounded bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
          >
            Отмена
          </Link>
        </div>
      </form>

      {!player.deletedAt && (
        <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
          <h2 className="font-semibold text-red-900">Опасная зона</h2>
          <p className="mt-1 text-sm text-red-800">
            Архивирование скрывает игрока из всех списков и аналитики. История
            тестирований сохраняется.
          </p>
          <form action={archivePlayer} className="mt-3">
            <input type="hidden" name="id" value={player.id} />
            <ArchiveButton />
          </form>
        </div>
      )}
    </div>
  );
}