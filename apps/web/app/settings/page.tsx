import { prisma } from '../../lib/prisma';
import {
  updateOrganization,
  updateTeam,
  updateSeason,
  resetDemoData,
} from './actions';
import ResetButton from './reset-button';
import RestoreButton from './restore-button';

const field = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm';
const label = 'block text-xs font-medium text-gray-500';

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
    <div className="space-y-5 p-6">
      <h1 className="text-3xl font-bold">Настройки</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold">Организация</h2>
          <form action={updateOrganization} className="space-y-3">
            <div>
              <label className={label}>Название</label>
              <input name="name" defaultValue={org?.name ?? ''} required className={field} />
            </div>
            <div>
              <label className={label}>
                Код{' '}
                <span className="text-gray-400">(системный идентификатор, не редактируется)</span>
              </label>
              <input
                name="code"
                defaultValue={org?.code ?? 'ORG'}
                readOnly
                className="mt-1 w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-500"
              />
            </div>
            <button className="btn-primary">Сохранить</button>
          </form>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold">Команда</h2>
          <form action={updateTeam} className="space-y-3">
            <div>
              <label className={label}>Название</label>
              <input name="name" defaultValue={team?.name ?? ''} required className={field} />
            </div>
            <div>
              <label className={label}>
                Код{' '}
                <span className="text-gray-400">(системный идентификатор, не редактируется)</span>
              </label>
              <input
                name="code"
                defaultValue={team?.code ?? 'TEAM'}
                readOnly
                className="mt-1 w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-500"
              />
            </div>
            <button className="btn-primary">Сохранить</button>
          </form>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold">Текущий сезон</h2>
          <form action={updateSeason} className="space-y-3">
            <div>
              <label className={label}>Название</label>
              <input
                name="name"
                defaultValue={season?.name ?? ''}
                placeholder="2026/27"
                required
                className={field}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Начало</label>
                <input
                  type="date"
                  name="startDate"
                  defaultValue={fmtDate(season?.startDate)}
                  required
                  className={field}
                />
              </div>
              <div>
                <label className={label}>Окончание</label>
                <input
                  type="date"
                  name="endDate"
                  defaultValue={fmtDate(season?.endDate)}
                  required
                  className={field}
                />
              </div>
            </div>
            <button className="btn-primary">Сохранить</button>
          </form>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold">Статистика системы</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Игроков</div>
              <div className="text-2xl font-bold">{playersCount}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Сессий</div>
              <div className="text-2xl font-bold">{sessionsCount}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Результатов</div>
              <div className="text-2xl font-bold">{resultsCount}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Тестов</div>
              <div className="text-2xl font-bold">{testsCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">Резервное копирование</h2>
        <p className="mb-3 text-sm text-gray-600">
          Скачайте полную копию данных в формате JSON для архива или переноса.
        </p>
        <a
          href="/api/backup"
          className="inline-block rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Скачать резервную копию
        </a>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <RestoreButton />
        </div>
      </div>
      <div className="rounded-lg border-2 border-red-200 bg-red-50 p-6">
        <h2 className="mb-2 text-lg font-bold text-red-900">⚠ Опасная зона</h2>
        <p className="mb-3 text-sm text-red-800">
          Сброс удалит всех игроков, сессии, результаты, цели и замеры. Нормативы, справочник
          тестов и оборудование сохранятся. Это действие необратимо — сначала скачайте резервную
          копию.
        </p>
        <form action={resetDemoData}>
          <ResetButton />
        </form>
      </div>

      <div className="text-xs text-gray-400">
        <p>Версия системы: PASKO PERFORMANCE v1.0</p>
        <p>
          Создано тренером по функциональной и кондиционной подготовке Пасько Сергеем
        </p>
      </div>
    </div>
  );
}