'use client';

import { useMemo, useState } from 'react';
import { selectContext } from './actions';

type OptionData = { organizations: { id: string; name: string }[]; teams: { id: string; name: string; organizationId: string; seasons: { id: string }[] }[]; seasons: { id: string; name: string }[] };

export default function ContextSelector({ data }: { data: OptionData }) {
  const [organizationId, setOrganizationId] = useState(data.organizations.length === 1 ? data.organizations[0].id : '');
  const teams = useMemo(() => data.teams.filter((team) => team.organizationId === organizationId), [data.teams, organizationId]);
  const [teamId, setTeamId] = useState(teams.length === 1 ? teams[0].id : '');
  const selectedTeam = teams.find((team) => team.id === teamId);
  const seasons = data.seasons.filter((season) => selectedTeam?.seasons.some((item) => item.id === season.id));
  const [seasonId, setSeasonId] = useState(seasons.length === 1 ? seasons[0].id : '');
  return (
    <form action={selectContext} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow">
      <div><label className="block text-sm font-medium" htmlFor="context-organization">Организация</label><select id="context-organization" name="organizationId" value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setTeamId(''); setSeasonId(''); }} required className="mt-1 w-full rounded border px-3 py-2"><option value="">Выберите организацию</option>{data.organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div><label className="block text-sm font-medium" htmlFor="context-team">Команда</label><select id="context-team" name="teamId" value={teamId} onChange={(event) => { setTeamId(event.target.value); setSeasonId(''); }} required className="mt-1 w-full rounded border px-3 py-2"><option value="">Выберите команду</option>{teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div><label className="block text-sm font-medium" htmlFor="context-season">Сезон</label><select id="context-season" name="seasonId" value={seasonId} onChange={(event) => setSeasonId(event.target.value)} required className="mt-1 w-full rounded border px-3 py-2"><option value="">Выберите сезон</option>{seasons.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <button className="btn-primary" type="submit">Продолжить</button>
    </form>
  );
}
