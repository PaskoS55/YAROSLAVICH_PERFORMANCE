export type WorkspaceKind = 'club' | 'demo';
export const DEMO_CAPABILITY_COOKIE = 'pasko_demo_capability';
export function getWorkspace(env: NodeJS.ProcessEnv = process.env): WorkspaceKind { return env.PASKO_WORKSPACE === 'demo' ? 'demo' : 'club'; }
export function isDemoWorkspace(env: NodeJS.ProcessEnv = process.env): boolean { return getWorkspace(env) === 'demo'; }
export function productionWorkspaceRequired(env: NodeJS.ProcessEnv = process.env): void { if (isDemoWorkspace(env)) throw new Error('PRODUCTION_WORKSPACE_REQUIRED'); }
