import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({demo:false,user:vi.fn(),session:vi.fn(),capability:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('next/headers',()=>({cookies:async()=>({get:(name:string)=>({value:name})})}));
vi.mock('next/navigation',()=>({redirect:(path:string)=>{throw Error(path);}}));
vi.mock('./current-user',()=>({requireCurrentUser:m.user}));
vi.mock('./session',()=>({readSession:m.session,readDemoCapability:m.capability}));
vi.mock('./workspace',()=>({isDemoWorkspace:()=>m.demo,DEMO_CAPABILITY_COOKIE:'pasko_demo_capability'}));
import {requireReferenceActor} from './reference-actor';
beforeEach(()=>{vi.clearAllMocks();m.demo=false;m.user.mockResolvedValue({id:'club-admin'});m.session.mockResolvedValue({userId:'club-admin'});m.capability.mockResolvedValue({userId:'club-admin'});});
it('Club still requires an enabled local administrator from its own DB',async()=>{
  expect(await requireReferenceActor()).toBe('club-admin');expect(m.user).toHaveBeenCalledOnce();expect(m.capability).not.toHaveBeenCalled();
});
it('Demo accepts only the existing Club-issued matching session/capability without a LocalUser copy',async()=>{
  m.demo=true;expect(await requireReferenceActor()).toBe('club-admin');expect(m.user).not.toHaveBeenCalled();
  expect(m.session).toHaveBeenCalledWith('yp_auth');expect(m.capability).toHaveBeenCalledWith('pasko_demo_capability');
});
it.each(['session','capability','mismatch'])('Demo rejects absent/expired/forged %s',async reason=>{
  m.demo=true;if(reason==='session')m.session.mockResolvedValue(null);
  if(reason==='capability')m.capability.mockResolvedValue(null);
  if(reason==='mismatch')m.capability.mockResolvedValue({userId:'another-user'});
  await expect(requireReferenceActor()).rejects.toThrow('/club-workspace');expect(m.user).not.toHaveBeenCalled();
});
