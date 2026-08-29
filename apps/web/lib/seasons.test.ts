import { expect, it, vi } from 'vitest';
import { createSeasonOnce, seasonDate } from './seasons';
it.each(['','invalid','2026-02-30','2026-13-01'])('rejects invalid season date %s', value => {expect(seasonDate(value)).toBeNull();});
it('preserves date-only season metadata at noon UTC',()=>{expect(seasonDate('2026-08-28')?.toISOString()).toBe('2026-08-28T12:00:00.000Z');});
it('locks the owning team and returns an existing same-team period without duplication',async()=>{
  const lock=vi.fn(),find=vi.fn().mockResolvedValue({id:'existing'}),create=vi.fn();
  const db={$transaction:async(fn:(tx:unknown)=>unknown)=>fn({$queryRaw:lock,season:{findFirst:find,create}})};
  const start=seasonDate('2026-01-01')!,end=seasonDate('2026-12-31')!;
  expect(await createSeasonOnce(db as never,'team','Season',start,end)).toEqual({id:'existing'});
  expect(lock).toHaveBeenCalled();expect(create).not.toHaveBeenCalled();
  expect(find).toHaveBeenCalledWith({where:{name:'Season',startDate:start,endDate:end,deletedAt:null,teams:{some:{id:'team'}}}});
});
