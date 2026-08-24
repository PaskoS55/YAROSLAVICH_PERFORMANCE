import { prisma } from '../../lib/prisma';
import { getAppContext } from '../../lib/app-context';
import { createContextSeason, createContextTeam } from './actions';
import ContextSelector from './context-selector';

const messages = { NO_ORGANIZATION: 'Требуется первоначальная настройка организации.', NO_TEAM: 'Создайте команду для продолжения.', NO_SEASON: 'Создайте сезон и свяжите его с командой.', INVALID_CONTEXT: 'Выбранный контекст больше недоступен.', SELECTION_REQUIRED: 'Выберите рабочую организацию, команду и сезон.', READY: 'При необходимости выберите другой рабочий контекст.' } as const;

const field = 'mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm';

export default async function ContextPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const query = await searchParams;
  const [state, organizations, teams, seasons] = await Promise.all([
    getAppContext(),
    prisma.organization.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.team.findMany({ where: { deletedAt: null, organization: { deletedAt: null } }, select: { id: true, name: true, organizationId: true, seasons: { where: { deletedAt: null }, select: { id: true } } }, orderBy: { name: 'asc' } }),
    prisma.season.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { startDate: 'desc' } }),
  ]);
  const selectable = organizations.length > 0 && teams.length > 0 && seasons.length > 0;
  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <div><h1 className="text-3xl font-bold">Рабочий контекст</h1><p className="mt-2 text-sm text-gray-600">{messages[state.status]}</p></div>
      {query.state?.endsWith('_FAILED') && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Не удалось создать запись. Проверьте значения и уникальность кода команды.
        </p>
      )}
      {selectable ? <ContextSelector data={{ organizations, teams, seasons }} /> : <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{messages[state.status]}</div>}
      {organizations.length > 0 && (
        <form action={createContextTeam} className="space-y-3 rounded-lg border bg-white p-5">
          <h2 className="font-bold">Создать команду</h2>
          <select name="organizationId" required className={field}><option value="">Организация</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select>
          <div className="grid grid-cols-2 gap-3"><input name="name" required placeholder="Название команды" className={field} /><input name="code" required placeholder="TEAM_CODE" className={field} /></div>
          <button type="submit" className="btn-primary">Создать команду</button>
        </form>
      )}
      {teams.length > 0 && (
        <form action={createContextSeason} className="space-y-3 rounded-lg border bg-white p-5">
          <h2 className="font-bold">Создать сезон</h2>
          <select name="teamId" required className={field}><option value="">Команда</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
          <input name="name" required placeholder="Название сезона" className={field} />
          <div className="grid grid-cols-2 gap-3"><input type="date" name="startDate" required className={field} /><input type="date" name="endDate" required className={field} /></div>
          <button type="submit" className="btn-primary">Создать сезон</button>
        </form>
      )}
      <p className="text-xs text-gray-500">Контекст определяет область данных интерфейса и не является моделью авторизации.</p>
    </div>
  );
}
