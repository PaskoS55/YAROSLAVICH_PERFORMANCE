import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ find:vi.fn(), snapshot:vi.fn(), result:vi.fn(), update:vi.fn(), upsert:vi.fn(), audit:vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath:vi.fn() }));
vi.mock('next/navigation', () => ({ redirect:(url:string) => { throw Error(url); } }));
vi.mock('next/headers', () => ({ cookies:async () => ({ get:() => ({ value:'synthetic' }) }) }));
vi.mock('../../lib/session', () => ({ readSession:async () => ({ userId:'synthetic-admin' }) }));
vi.mock('../../lib/app-context', () => ({ requireAppContext:async () => ({ organizationId:'current-org',teamId:'current-team',seasonId:'current-season' }) }));
vi.mock('../../lib/qc', () => ({ computeQcStatus:() => 'PASSED',syncQcFlag:vi.fn() }));
vi.mock('../../lib/prisma', () => ({ prisma:{ $transaction:async (fn: (tx: unknown) => unknown) => fn({
  $queryRaw:vi.fn(), bodyComposition:{findFirst:m.find,findFirstOrThrow:m.snapshot,update:m.update},
  test:{findUniqueOrThrow:async () => ({id:'mass-test',unit:'kg'})},
  testResult:{findUnique:m.result,upsert:m.upsert},auditLog:{create:m.audit},
}) } }));
import { resolveBodyConflict } from './conflict-actions';
const time = new Date('2026-01-01T00:00:00Z');
const snapshot = {id:'body',testSessionId:'session',playerId:'player',mass_kg:92,updatedAt:time,testSession:{playerId:'player'}};
const result = {id:'result',playerId:'player',value:90,deletedAt:null,updatedAt:time};
const form = (choice='test') => {
  const data=new FormData();
  for(const [k,v] of Object.entries({snapshot:'body',metric:'BC_MASS',choice,snapshotVersion:time.toISOString(),resultVersion:time.toISOString(),organizationId:'forged-org',teamId:'forged-team',seasonId:'forged-season'}))data.set(k,v);
  return data;
};
beforeEach(() => {
  vi.clearAllMocks();m.find.mockResolvedValue(snapshot);m.snapshot.mockResolvedValue(snapshot);m.result.mockResolvedValue(result);m.upsert.mockResolvedValue({id:'result'});
});
it('uses exact current server context, not browser organization/team/season', async () => {
  await expect(resolveBodyConflict(form())).rejects.toThrow('/body?saved=1');
  expect(m.find).toHaveBeenCalledWith({where:expect.objectContaining({id:'body',player:{teamId:'current-team',deletedAt:null},testSession:{teamId:'current-team',seasonId:'current-season',deletedAt:null}})});
  expect(m.update).toHaveBeenCalledWith({where:{id:'body'},data:{mass_kg:90}});
  expect(m.upsert).not.toHaveBeenCalled();
  expect(m.audit).toHaveBeenCalledWith({data:expect.objectContaining({userId:'synthetic-admin',oldValues:expect.objectContaining({bodyValue:92,testValue:90})})});
});
it('rejects foreign-context snapshot without writes', async () => {
  m.find.mockResolvedValue(null);
  await expect(resolveBodyConflict(form())).rejects.toThrow('/body?error=resolution');
  expect(m.update).not.toHaveBeenCalled();expect(m.upsert).not.toHaveBeenCalled();
});
it('rejects mismatched player/session identity', async () => {
  m.snapshot.mockResolvedValue({...snapshot,testSession:{playerId:'other-player'}});
  await expect(resolveBodyConflict(form())).rejects.toThrow('/body?error=resolution');
  expect(m.update).not.toHaveBeenCalled();expect(m.upsert).not.toHaveBeenCalled();
});
it('rejects a stale decision instead of overwriting a newer value', async () => {
  m.result.mockResolvedValue({...result,updatedAt:new Date(time.getTime()+1)});
  await expect(resolveBodyConflict(form('body'))).rejects.toThrow('/body?error=resolution');
  expect(m.update).not.toHaveBeenCalled();expect(m.upsert).not.toHaveBeenCalled();
});
it('replays an already resolved decision without duplicate audit events', async () => {
  m.result.mockResolvedValue({...result,value:92});
  await expect(resolveBodyConflict(form())).rejects.toThrow('/body?saved=1');
  expect(m.update).not.toHaveBeenCalled();expect(m.audit).not.toHaveBeenCalled();
});
it('explicit body choice changes only the exactly linked metric and snapshot', async () => {
  await expect(resolveBodyConflict(form('body'))).rejects.toThrow('/body?saved=1');
  expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({where:{testSessionId_testId:{testSessionId:'session',testId:'mass-test'}},update:{value:92,qcStatus:'PASSED',deletedAt:null}}));
  expect(m.update).toHaveBeenCalledWith({where:{id:'body'},data:{mass_kg:92}});
});
