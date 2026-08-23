import { prisma } from "../../lib/prisma";
import {
  updateTeam,
  updateSeason,
  createTeam,
  createSeason,
  resetDemoData,
} from "./actions";
import ResetButton from "./reset-button";
import RestoreButton from "./restore-button";
import { PRODUCT_IDENTITY } from "@pasko-performance/core/product";
import { requireAppContext } from "../../lib/app-context";
import Link from "next/link";
import { changePassword } from "./security-actions";
import { CopyInstallationId } from "./copy-installation-id";
import { OrganizationBrandingForm } from "./organization-branding-form";

const field = "mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm";
const label = "block text-xs font-medium text-gray-500";

function fmtDate(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

export default async function SettingsPage() {
  const context = await requireAppContext();
  const [org, team, season, teams, seasons, stats] = await Promise.all([
    prisma.organization.findUnique({ where: { id: context.organizationId } }),
    prisma.team.findUnique({ where: { id: context.teamId } }),
    prisma.season.findUnique({ where: { id: context.seasonId } }),
    prisma.team.findMany({
      where: { organizationId: context.organizationId, deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.season.findMany({
      where: { deletedAt: null, teams: { some: { id: context.teamId } } },
      orderBy: { startDate: "desc" },
    }),
    Promise.all([
      prisma.player.count({
        where: { teamId: context.teamId, deletedAt: null },
      }),
      prisma.testSession.count({
        where: {
          teamId: context.teamId,
          seasonId: context.seasonId,
          deletedAt: null,
        },
      }),
      prisma.testResult.count({
        where: {
          deletedAt: null,
          testSession: {
            teamId: context.teamId,
            seasonId: context.seasonId,
            deletedAt: null,
          },
        },
      }),
      prisma.test.count({ where: { deletedAt: null } }),
    ]),
  ]);

  const [playersCount, sessionsCount, resultsCount, testsCount] = stats;

  return (
    <div className="space-y-5 p-6">
      <h1 className="text-3xl font-bold">Настройки</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6 lg:col-span-2">
          <h2 className="mb-1 text-lg font-bold">Клуб и оформление</h2>
          <p className="mb-5 text-sm text-gray-500">Цвета клуба используются только как акценты и не изменяют официальный фирменный стиль продукта.</p>
          {org && <OrganizationBrandingForm organization={org} />}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold">Команда</h2>
          <form action={updateTeam} className="space-y-3">
            <div>
              <label className={label}>Название</label>
              <input
                name="name"
                defaultValue={team?.name ?? ""}
                required
                className={field}
              />
            </div>
            <div>
              <label className={label}>
                Код{" "}
                <span className="text-gray-400">
                  (системный идентификатор, не редактируется)
                </span>
              </label>
              <input
                name="code"
                defaultValue={team?.code ?? "TEAM"}
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
                defaultValue={season?.name ?? ""}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-bold">Команды организации</h2>
          <ul className="mb-4 space-y-1 text-sm">
            {teams.map((item) => (
              <li key={item.id}>
                {item.name}{" "}
                <span className="font-mono text-gray-400">{item.code}</span>
                {item.id === context.teamId && " · активна"}
              </li>
            ))}
          </ul>
          <form action={createTeam} className="grid grid-cols-2 gap-2">
            <input
              name="name"
              required
              placeholder="Название"
              className={field}
            />
            <input name="code" required placeholder="CODE" className={field} />
            <button className="btn-primary col-span-2">Создать команду</button>
          </form>
          <Link
            href="/context"
            className="mt-3 inline-block text-sm link-action"
          >
            Сменить команду →
          </Link>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-bold">Сезоны команды</h2>
          <ul className="mb-4 space-y-1 text-sm">
            {seasons.map((item) => (
              <li key={item.id}>
                {item.name}
                {item.id === context.seasonId && " · активен"}
              </li>
            ))}
          </ul>
          <form action={createSeason} className="space-y-2">
            <input
              name="name"
              required
              placeholder="2027/28"
              className={field}
            />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" name="startDate" required className={field} />
              <input type="date" name="endDate" required className={field} />
            </div>
            <button className="btn-primary">Создать сезон</button>
          </form>
          <Link
            href="/context"
            className="mt-3 inline-block text-sm link-action"
          >
            Сменить сезон →
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">Безопасность</h2>
        <form action={changePassword} className="grid max-w-lg gap-3">
          <input
            className={field}
            type="password"
            name="currentPassword"
            required
            placeholder="Текущий пароль"
          />
          <input
            className={field}
            type="password"
            name="newPassword"
            required
            minLength={12}
            maxLength={256}
            placeholder="Новый пароль"
          />
          <input
            className={field}
            type="password"
            name="confirmPassword"
            required
            placeholder="Подтверждение нового пароля"
          />
          <button className="btn-primary">Изменить пароль</button>
        </form>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-lg font-bold">О {PRODUCT_IDENTITY.shortProductName}</h2>
        <p className="mb-4 text-sm font-semibold text-gray-500">{PRODUCT_IDENTITY.display}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt>Продукт</dt>
          <dd>{PRODUCT_IDENTITY.canonical}</dd>
          <dt>Направление</dt>
          <dd>{PRODUCT_IDENTITY.vertical}</dd>
          <dt>ID установки</dt>
          <dd className="break-all">
            <span className="font-mono">
              {process.env.PASKO_INSTALLATION_ID || "Доступен в Desktop-сборке"}
            </span>
            {process.env.PASKO_INSTALLATION_ID && (
              <CopyInstallationId value={process.env.PASKO_INSTALLATION_ID} />
            )}
          </dd>
          <dt>Организация</dt>
          <dd>{org?.name}</dd>
          <dt>Команда</dt>
          <dd>{team?.name}</dd>
          <dt>Сезон</dt>
          <dd>{season?.name}</dd>
          <dt>Создатель</dt>
          <dd>Сергей Пасько<br /><span className="text-gray-500">Тренер по функциональной и кондиционной подготовке</span></dd>
          <dt>Версия</dt>
          <dd>1.0.0</dd>
        </dl>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">Резервное копирование</h2>
        <p className="mb-3 text-sm text-gray-600">
          Installation-wide backup: полная копия всех организаций и команд для
          администрирования установки.
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
          Installation-wide сброс удалит данные всех команд: игроков, сессии,
          результаты, цели и замеры. Нормативы, справочник тестов и оборудование
          сохранятся. Это действие необратимо — сначала скачайте резервную
          копию.
        </p>
        <form action={resetDemoData}>
          <ResetButton />
        </form>
      </div>

      <div className="text-xs text-gray-400">
        <p>Версия системы: {PRODUCT_IDENTITY.display} v1.0</p>
        <p>
          Product: {PRODUCT_IDENTITY.canonical} · Vertical:{" "}
          {PRODUCT_IDENTITY.vertical}
        </p>
        <p>{PRODUCT_IDENTITY.creator.creditRu}</p>
        <p>{PRODUCT_IDENTITY.creator.creditEn}</p>
      </div>
    </div>
  );
}
