import { prisma } from '../../lib/prisma';
import { updateOrganization, updateTeam, updateSeason, resetDemoData } from './actions';
import ResetButton from './reset-button';

function fmtDate(d: Date | null | undefined) {
  if (!d) return '';
  return new Date(d).toISOString().split('T')[0];
}

export default async function SettingsPage() {
  const [org, team, season, stats] = await Promise.all([
    prisma.organization.findFirst(),
    prisma.team.findFirst(),
    prisma.season.findFirst(),
    Promise.all([
      prisma.player.count({ where: { deletedAt: null } }),
      prisma.testSession.count({ where: { deletedAt: null } }),
      prisma.testResult.count({ where: { deletedAt: null } }),
      prisma.test.count({ where: { deletedAt: null } }),
    ]),
  ]);

  const [playersCount, sessionsCount, resultsCount, testsCount] = stats;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Настройки</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Организация</h2>
          <form action={updateOrganization} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input
                name="name"
                defaultValue={org?.name ?? ''}
                className="w-full rounded border-2 border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Код</label>
              <input
                name="code"
                defaultValue={org?.code ?? ''}
                className="w-full rounded border-2 border-gray-300 px-3 py-2 font-mono"
              />
            </div>
            <button className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              Сохранить
            </button>
          </form>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Команда</h2>
          <form action={updateTeam} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input
                name="name"
                defaultValue={team?.name ?? ''}
                className="w-full rounded border-2 border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Код</label>
              <input
                name="code"
                defaultValue={team?.code ?? ''}
                className="w-full rounded border-2 border-gray-300 px-3 py-2 font-mono"
              />
            </div>
            <button className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              Сохранить
            </button>
          </form>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Текущий сезон</h2>
          <form action={updateSeason} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input
                name="name"
                defaultValue={season?.name ?? ''}
                placeholder="2026/27"
                className="w-full rounded border-2 border-gray-300 px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Начало</label>
                <input
                  type="date"
                  name="startDate"
                  defaultValue={fmtDate(season?.startDate)}
                  className="w-full rounded border-2 border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Окончание</label>
                <input
                  type="date"
                  name="endDate"
                  defaultValue={fmtDate(season?.endDate)}
                  className="w-full rounded border-2 border-gray-300 px-3 py-2"
                />
              </div>
            </div>
            <button className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              Сохранить
            </button>
          </form>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Статистика системы</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Игроков:</span>
              <span className="font-semibold">{playersCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Сессий:</span>
              <span className="font-semibold">{sessionsCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Результатов:</span>
              <span className="font-semibold">{resultsCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Тестов в справочнике:</span>
              <span className="font-semibold">{testsCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">Системные действия</h2>
        <div className="space-y-4">
          <div className="rounded-lg border-2 border-yellow-200 bg-yellow-50 p-4">
            <h3 className="font-semibold text-yellow-900">Сброс демо-данных</h3>
            <p className="mt-1 text-sm text-yellow-800">
              Удаляет всех игроков, сессии, результаты, цели и нормативы. Справочник тестов и оборудование сохраняются.
            </p>
                      <form action={resetDemoData} className="mt-3">
              <ResetButton />
            </form>
          </div>
          <a
            href="/api/backup"
            className="mb-3 inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Скачать резервную копию (JSON)
          </a>

          <form action="/api/auth/logout" className="mt-4">
            <button className="rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-800">
              Выйти из системы
            </button>
          </form>

          <div className="text-xs text-gray-500">
            <p>Версия системы: PASKO PERFORMANCE v1.0</p>
            <p>Технологии: создано тренером по функцианальной и кондиционной подготовке Пасько Сергеем</p>
            <p>База данных: localhost:5432</p>
          </div>
        </div>
      </div>
    </div>
  );
}