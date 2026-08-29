import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({find:vi.fn(),create:vi.fn(),lock:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('next/navigation',()=>({redirect:(url:string)=>{throw Error(url);}}));
vi.mock('../../../lib/app-context',()=>({requireAppContext:async()=>({teamId:'current-team'})}));
vi.mock('../../../lib/prisma',()=>({prisma:{$transaction:async(fn:(tx:unknown)=>unknown)=>fn({$queryRaw:m.lock,player:{findUnique:m.find,findFirst:async()=>null,count:async()=>0,create:m.create}})}}));
import {createPlayer} from './actions';
const id='00000000-0000-4000-8000-000000000001';
const form=()=>{const f=new FormData();Object.entries({submissionId:id,firstName:'Synthetic',lastName:'Retry',teamId:'forged'}).forEach(([k,v])=>f.set(k,v));return f;};
beforeEach(()=>{vi.clearAllMocks();m.find.mockResolvedValue(null);});
it('same form retry returns without creating a second auto-coded player',async()=>{
  await expect(createPlayer(form())).rejects.toThrow('/players');
  m.find.mockResolvedValue({id,teamId:'current-team'});
  await expect(createPlayer(form())).rejects.toThrow('/players');
  expect(m.create).toHaveBeenCalledOnce();expect(m.lock).toHaveBeenCalledTimes(2);
  expect(m.create).toHaveBeenCalledWith({data:expect.objectContaining({id,playerId:'P001',teamId:'current-team'})});
});
it('forged id of a foreign-team player is rejected without writes',async()=>{
  m.find.mockResolvedValue({id,teamId:'other-team'});
  await expect(createPlayer(form())).rejects.toThrow('/players/new?error=foreign');expect(m.create).not.toHaveBeenCalled();
});
it('missing retry identity is rejected rather than silently creating another player',async()=>{
  const f=form();f.delete('submissionId');await expect(createPlayer(f)).rejects.toThrow('/players/new?error=retry');expect(m.create).not.toHaveBeenCalled();
});
