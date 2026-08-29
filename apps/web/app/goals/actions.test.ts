import { beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({create:vi.fn(),find:vi.fn(),lock:vi.fn(),sync:vi.fn(),player:vi.fn(),test:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('next/navigation',()=>({redirect:(url:string)=>{throw Error(url);}}));
vi.mock('../../lib/app-context',()=>({requireAppContext:async()=>({teamId:'team',seasonId:'ignored'})}));
vi.mock('../../lib/goals',()=>({syncGoalsForResult:m.sync}));
vi.mock('../../lib/prisma',()=>({prisma:{player:{findFirst:m.player},test:{findFirst:m.test},
  $transaction:async(fn:(tx:unknown)=>unknown)=>fn({$queryRaw:m.lock,playerGoal:{findFirst:m.find,create:m.create}})}}));
import {createGoal} from './actions';
const form=(target='50',date='2030-01-01')=>{const f=new FormData();Object.entries({playerId:'p',testId:'t',targetValue:target,targetDate:date,teamId:'forged',seasonId:'forged'}).forEach(([k,v])=>f.set(k,v));return f;};
beforeEach(()=>{vi.clearAllMocks();m.player.mockResolvedValue({id:'p'});m.test.mockResolvedValue({id:'t'});m.find.mockResolvedValue(null);});
it.each(['',' ','NaN','Infinity','abc'])('rejects empty/nonfinite target %s',async target=>{
  await expect(createGoal(form(target))).rejects.toThrow('/goals?error=invalid');expect(m.create).not.toHaveBeenCalled();
});
it.each(['2030-02-30','invalid'])('rejects invalid calendar date %s',async date=>{
  await expect(createGoal(form('50',date))).rejects.toThrow('/goals?error=invalid');expect(m.create).not.toHaveBeenCalled();
});
it('serializes same-player retry and does not create an identical active goal twice',async()=>{
  m.find.mockResolvedValueOnce(null).mockResolvedValueOnce({id:'g'});
  await createGoal(form());await createGoal(form());
  expect(m.lock).toHaveBeenCalledTimes(2);expect(m.create).toHaveBeenCalledTimes(1);
  expect(m.sync).toHaveBeenCalledWith(expect.anything(),'p','t','team');
});
it('rejects another team player and ignores forged team/season fields',async()=>{
  m.player.mockResolvedValue(null);await createGoal(form());expect(m.create).not.toHaveBeenCalled();
  expect(m.player).toHaveBeenCalledWith({where:{id:'p',teamId:'team',deletedAt:null}});
});
