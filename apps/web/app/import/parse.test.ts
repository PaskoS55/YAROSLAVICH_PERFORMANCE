import {expect,it} from 'vitest';
import {parseImport} from './parse';
it.each(['',' ','NaN','Infinity','текст'])('does not invent a numeric result from %s',value=>{
  const rows=parseImport(`P001;2026-08-01;BC_MASS;${value};INSEASON`);
  expect(rows).toHaveLength(1);expect(rows[0].valid).toBe(false);
});
it('recognizes the actual header and preserves explicit zero and comma precision',()=>{
  const rows=parseImport('\uFEFFPlayerID;Date;TestCode;Value;Phase\nP001;2026-08-01;MOB_SL;0;INSEASON\nP001;2026-08-01;BC_MASS;92,15;INSEASON');
  expect(rows.map(row=>[row.value,row.valid])).toEqual([[0,true],[92.15,true]]);
});
it('retains the first invalid data row instead of silently treating it as a header',()=>{
  expect(parseImport('P001,2026-08-01,BC_MASS,bad')[0]).toMatchObject({line:1,valid:false});
});
