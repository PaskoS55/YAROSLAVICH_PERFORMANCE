import type { ContextSelection } from './context-cookie';

export type ReadyAppContext = {
  status: 'READY';
  organizationId: string;
  organizationName: string;
  organizationShortName: string | null;
  organizationLogoAssetKey: string | null;
  organizationPrimaryColor: string | null;
  organizationSecondaryColor: string | null;
  teamId: string;
  teamName: string;
  teamCode: string;
  seasonId: string;
  seasonName: string;
  seasonStartDate: Date;
  seasonEndDate: Date;
};

export type AppContextState = ReadyAppContext | {
  status: 'NO_ORGANIZATION' | 'NO_TEAM' | 'NO_SEASON' | 'SELECTION_REQUIRED' | 'INVALID_CONTEXT';
  level?: 'ORGANIZATION' | 'TEAM' | 'SEASON';
};

type ContextDb = {
  organization: { findMany(args: unknown): Promise<any[]>; findFirst(args: unknown): Promise<any> };
  team: { findMany(args: unknown): Promise<any[]>; findFirst(args: unknown): Promise<any> };
  season: { findMany(args: unknown): Promise<any[]>; findFirst(args: unknown): Promise<any> };
};

const organizationSelect = { id: true, name: true, shortName: true, logoAssetKey: true, primaryColor: true, secondaryColor: true } as const;
const teamSelect = { id: true, name: true, code: true, organizationId: true } as const;
const seasonSelect = { id: true, name: true, startDate: true, endDate: true } as const;

function ready(organization: any, team: any, season: any): ReadyAppContext {
  return {
    status: 'READY', organizationId: organization.id, organizationName: organization.name,
    organizationShortName: organization.shortName, organizationLogoAssetKey: organization.logoAssetKey,
    organizationPrimaryColor: organization.primaryColor, organizationSecondaryColor: organization.secondaryColor,
    teamId: team.id, teamName: team.name, teamCode: team.code,
    seasonId: season.id, seasonName: season.name, seasonStartDate: season.startDate, seasonEndDate: season.endDate,
  };
}

export async function resolveAppContext(db: ContextDb, selection: ContextSelection | null): Promise<AppContextState> {
  if (selection) {
    const organization = await db.organization.findFirst({ where: { id: selection.organizationId, deletedAt: null }, select: organizationSelect });
    if (!organization) return { status: 'INVALID_CONTEXT', level: 'ORGANIZATION' };
    const team = await db.team.findFirst({ where: { id: selection.teamId, organizationId: organization.id, deletedAt: null }, select: teamSelect });
    if (!team) return { status: 'INVALID_CONTEXT', level: 'TEAM' };
    const season = await db.season.findFirst({ where: { id: selection.seasonId, deletedAt: null, teams: { some: { id: team.id } } }, select: seasonSelect });
    if (!season) return { status: 'INVALID_CONTEXT', level: 'SEASON' };
    return ready(organization, team, season);
  }

  const organizations = await db.organization.findMany({ where: { deletedAt: null }, select: organizationSelect, take: 2, orderBy: { createdAt: 'asc' } });
  if (organizations.length === 0) return { status: 'NO_ORGANIZATION' };
  if (organizations.length !== 1) return { status: 'SELECTION_REQUIRED', level: 'ORGANIZATION' };
  const organization = organizations[0];
  const teams = await db.team.findMany({ where: { organizationId: organization.id, deletedAt: null }, select: teamSelect, take: 2, orderBy: { createdAt: 'asc' } });
  if (teams.length === 0) return { status: 'NO_TEAM' };
  if (teams.length !== 1) return { status: 'SELECTION_REQUIRED', level: 'TEAM' };
  const team = teams[0];
  const seasons = await db.season.findMany({ where: { deletedAt: null, teams: { some: { id: team.id } } }, select: seasonSelect, take: 2, orderBy: { startDate: 'desc' } });
  if (seasons.length === 0) return { status: 'NO_SEASON' };
  if (seasons.length !== 1) return { status: 'SELECTION_REQUIRED', level: 'SEASON' };
  return ready(organization, team, seasons[0]);
}
