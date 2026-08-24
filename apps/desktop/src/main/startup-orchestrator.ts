export interface DatabaseService { databaseUrl: string; stop(): Promise<boolean> }
export interface WebService { stop(): boolean }
export class PackagedStartupError extends Error {
  constructor(public readonly stage: 'database' | 'web', cause: unknown) { super(`${stage} startup failed`, { cause }); }
}

export async function startPackagedServices<TDatabase extends DatabaseService, TWeb extends WebService>(input: { startDatabase: () => Promise<TDatabase>; startWeb: (databaseUrl: string) => Promise<TWeb> }): Promise<{ database: TDatabase; web: TWeb }> {
  let database: TDatabase;
  try { database = await input.startDatabase(); }
  catch (error) { throw new PackagedStartupError('database', error); }
  try { return { database, web: await input.startWeb(database.databaseUrl) }; }
  catch (error) { await database.stop().catch(() => false); throw new PackagedStartupError('web', error); }
}

export async function stopPackagedServices(input: { web: WebService | null; database: DatabaseService | null }): Promise<void> {
  input.web?.stop();
  await input.database?.stop().catch(() => false);
}
