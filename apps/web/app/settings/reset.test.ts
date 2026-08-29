import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({auth:vi.fn(),transaction:vi.fn(),demo:false}));
vi.mock('../../lib/prisma',()=>({prisma:{$transaction:m.transaction}}));
vi.mock('../../lib/current-user',()=>({requireCurrentUser:m.auth}));
vi.mock('../../lib/app-context',()=>({requireAppContext:async()=>({teamId:'synthetic'})}));
vi.mock('../../lib/workspace',()=>({isDemoWorkspace:()=>m.demo}));
vi.mock('@pasko-performance/db',()=>({resetDemoDatabase:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
import {resetDemoData} from './actions';
beforeEach(()=>{vi.clearAllMocks();m.demo=false;m.auth.mockResolvedValue({id:'admin'});});
it.each(['','сбросить','СБРОСИТЬ ','RESET'])('does not reset for unconfirmed request %s',async value=>{
  const form=new FormData();form.set('confirmation',value);
  await expect(resetDemoData(form)).rejects.toThrow('RESET_NOT_CONFIRMED');
  expect(m.transaction).not.toHaveBeenCalled();
});
it('does not reset without local user authorization',async()=>{
  m.auth.mockRejectedValueOnce(Error('NO_USER'));
  const form=new FormData();form.set('confirmation','СБРОСИТЬ');
  await expect(resetDemoData(form)).rejects.toThrow('NO_USER');expect(m.transaction).not.toHaveBeenCalled();
});
it('cannot use the club reset action against Demo',async()=>{
  m.demo=true;const form=new FormData();form.set('confirmation','СБРОСИТЬ');
  await expect(resetDemoData(form)).rejects.toThrow('USE_DEMO_RESET_ACTION');expect(m.transaction).not.toHaveBeenCalled();
});
