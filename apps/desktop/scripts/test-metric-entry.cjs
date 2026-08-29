const assert = require('node:assert/strict');
module.exports = async function metricEntry({win,club,sql}) {
  const web=win.webContents;
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const id='entry-audit-player';
  const values={STR_PULL:180,STR_SQUAT:150,PWR_CMJ:48.5,PWR_BJ:250,SPD_10:1.7,SPD_20:3.1,AGI_TTEST:10,AGI_505:2.6,VB_APP:337,VB_BLOCK:318,VB_SERVE:100,MOB_OHS:7,MOB_SL:8,BC_MASS:92,BC_FAT:15,BC_FFM:78.2};
  await sql(`INSERT INTO players(id,"playerId","firstName","lastName",position,"birthDate","teamId","updatedAt") VALUES ('${id}','ENTRY-AUDIT','Ввод','Проверка','setter','1990-01-01','nav-team',now())`);
  const tests=JSON.parse(await sql(`SELECT json_agg(t ORDER BY code) FROM (SELECT id,code,name,unit FROM tests WHERE deleted_at IS NULL) t`));
  assert.equal(tests.length,Object.keys(values).length);
  async function input(selector,value,select=false) {
    await web.executeJavaScript(`(() => { const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${select?'HTMLSelectElement':'HTMLInputElement'}.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(${JSON.stringify(select?'change':'input')},{bubbles:true})); })()`);
  }
  const save=()=>web.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='Сохранить результаты').click(); undefined;`);
  async function saved(){for(let i=0;i<150;i++){if(await web.executeJavaScript(`document.body.innerText.includes('✓ Сохранено:') || document.body.innerText.includes('✓ Результаты сохранены')`))return;await pause(100);}throw Error('Metric entry did not save');}
  try {
    for(const test of tests){
      await win.loadURL(new URL('/testing/team',club.origin).href);
      await input('select',test.id,true);
      assert.ok((await web.executeJavaScript('document.body.innerText')).includes(`Единица: ${test.unit}`));
      // Locate the row by immutable fixture code, not by row order.
      await web.executeJavaScript(`(() => {const e=Array.from(document.querySelectorAll('input[inputmode="decimal"]')).find(e=>e.parentElement.parentElement.innerText.includes('ENTRY-AUDIT'));e.id='entry-target';})()`);
      for(const invalid of ['NaN','Infinity','текст']) {
        await input('#entry-target',invalid);await save();
        assert.ok((await web.executeJavaScript('document.body.innerText')).includes('введено не число'));
      }
      await input('#entry-target',String(values[test.code]).replace('.',','));await save();await saved();
      assert.equal(Number(await sql(`SELECT r.value FROM test_results r JOIN tests t ON t.id=r."testId" WHERE r."playerId"='${id}' AND t.code='${test.code}'`)),values[test.code]);
      assert.equal(await sql(`SELECT "qcStatus" FROM test_results WHERE "playerId"='${id}' AND "testId"='${test.id}'`),'PASSED');
    }
    assert.equal(await sql(`SELECT count(*) FROM test_sessions WHERE "playerId"='${id}'`),'1');
    assert.equal(await sql(`SELECT count(*) FROM test_results WHERE "playerId"='${id}'`),'16');
    assert.equal(await sql(`SELECT mass_kg||'|'||fat_pct||'|'||ffm_kg FROM body_compositions WHERE "playerId"='${id}'`),'92|15|78.2');
    const sessionId=await sql(`SELECT id FROM test_sessions WHERE "playerId"='${id}'`);
    let capturedBody, capturedHeaders;
    web.session.webRequest.onBeforeRequest((details,callback)=>{
      if(details.method==='POST' && new URL(details.url).pathname===`/sessions/${sessionId}` && details.uploadData)capturedBody=Buffer.concat(details.uploadData.map(part=>part.bytes ?? Buffer.alloc(0)));
      callback({});
    });
    web.session.webRequest.onBeforeSendHeaders((details,callback)=>{
      if(details.method==='POST' && new URL(details.url).pathname===`/sessions/${sessionId}`)capturedHeaders=details.requestHeaders;
      callback({requestHeaders:details.requestHeaders});
    });
    await win.loadURL(new URL(`/sessions/${sessionId}`,club.origin).href);
    // Save the same complete session twice: values and number of rows remain stable.
    await save();await saved();await save();await saved();
    assert.equal(await sql(`SELECT count(*) FROM test_results WHERE "playerId"='${id}'`),'16');
    const cmj=tests.find(test=>test.code==='PWR_CMJ');
    await sql(`INSERT INTO player_goals(id,"playerId","testId","targetValue","targetDate","updatedAt") VALUES ('entry-audit-goal','${id}','${cmj.id}',50,now()+interval '30 day',now())`);
    await win.loadURL(new URL('/testing/team',club.origin).href);
    await input('select',cmj.id,true);
    await web.executeJavaScript(`Array.from(document.querySelectorAll('input[inputmode="decimal"]')).find(e=>e.parentElement.parentElement.innerText.includes('ENTRY-AUDIT')).id='entry-target'`);
    await input('#entry-target','999');await save();
    await web.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='Подтвердить и сохранить').click(); undefined;`);await saved();
    assert.equal(await sql(`SELECT "qcStatus" FROM test_results WHERE "playerId"='${id}' AND "testId"='${cmj.id}'`),'FAILED');
    assert.equal(await sql(`SELECT achieved FROM player_goals WHERE id='entry-audit-goal'`),'f');
    await win.loadURL(new URL(`/analytics?playerId=${id}&testId=${cmj.id}`,club.origin).href);
    assert.equal(await web.executeJavaScript(`document.querySelectorAll('svg[viewBox="0 0 600 240"] g text:first-of-type').length`),0);
    await win.loadURL(new URL('/qc',club.origin).href);
    await web.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='Отметить решённым').click(); undefined;`);
    assert.equal(await web.executeJavaScript(`!!document.querySelector('[role="dialog"]')`),true);
    await web.executeJavaScript(`Array.from(document.querySelectorAll('[role="dialog"] button')).find(e=>e.textContent==='Отмена').click(); undefined;`);
    assert.equal(await sql(`SELECT "qcStatus" FROM test_results WHERE "playerId"='${id}' AND "testId"='${cmj.id}'`),'FAILED');
    await web.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='Отметить решённым').click(); undefined;`);
    await web.executeJavaScript(`Array.from(document.querySelectorAll('[role="dialog"] button')).find(e=>e.textContent==='Подтвердить').click(); undefined;`);
    for(let i=0;i<150;i++){if(await sql(`SELECT achieved FROM player_goals WHERE id='entry-audit-goal'`)==='t')break;await pause(100);}
    assert.equal(await sql(`SELECT "qcStatus" FROM test_results WHERE "playerId"='${id}' AND "testId"='${cmj.id}'`),'PASSED');
    assert.equal(await sql(`SELECT achieved FROM player_goals WHERE id='entry-audit-goal'`),'t');
    console.log('QC UI: flagged measurement excluded, Cancel preserves FAILED, explicit resolve -> PASSED and goal recalculation PASS');
    const csvDate=new Date(Date.now()-4*86400000).toISOString().slice(0,10);
    const csv=`PlayerID;Date;TestCode;Value;Phase\nENTRY-AUDIT;${csvDate};BC_MASS;92,15;INSEASON\nENTRY-AUDIT;${csvDate};BC_FAT;15;INSEASON\nENTRY-AUDIT;${csvDate};BC_FFM;78,23;INSEASON\nENTRY-AUDIT;${csvDate};BC_MASS;;INSEASON\nNO-SUCH-PLAYER;${csvDate};BC_MASS;90;INSEASON`;
    for(let repeat=0;repeat<2;repeat++) {
      await win.loadURL(new URL('/import',club.origin).href);
      await web.executeJavaScript(`(() => {const e=document.querySelector('input[type="file"]');const d=new DataTransfer();d.items.add(new File([${JSON.stringify(csv)}],'synthetic.csv',{type:'text/csv'}));e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      for(let i=0;i<100;i++){if((await web.executeJavaScript('document.body.innerText')).includes('результат не заполнен'))break;await pause(50);}
      assert.match(await web.executeJavaScript('document.body.innerText'),/результат не заполнен/);
      await web.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='Импортировать 4 строк').click(); undefined;`);
      for(let i=0;i<150;i++){if((await web.executeJavaScript('document.body.innerText')).includes('Импортировано: 3. Ошибок: 1'))break;await pause(100);}
      assert.match(await web.executeJavaScript('document.body.innerText'),/Импортировано: 3\. Ошибок: 1/);
      assert.equal(await sql(`SELECT count(*) FROM test_results WHERE "playerId"='${id}'`),'19');
      assert.equal(await sql(`SELECT count(*) FROM body_compositions WHERE "playerId"='${id}'`),'2');
    }
    console.log('CSV UI: comma precision, blank rejected, unknown player reported, re-import idempotent, canonical BC projection PASS');
    await sql(`UPDATE players SET "playerId"='ИГРОК-АУДИТ' WHERE id='${id}'`);
    const exportHeader=await web.executeJavaScript(`fetch(${JSON.stringify(`/api/export?type=player&id=${id}`)}).then(r=>({status:r.status,disposition:r.headers.get('content-disposition'),text:r.text()})).then(async r=>({...r,text:await r.text}))`);
    assert.equal(exportHeader.status,200);
    assert.match(exportHeader.disposition,/filename\*=UTF-8''player_%D0%98%D0%93%D0%A0%D0%9E%D0%9A-%D0%90%D0%A3%D0%94%D0%98%D0%A2\.csv/);
    assert.match(exportHeader.text,/ИГРОК-АУДИТ/);
    await sql(`UPDATE players SET "playerId"='ENTRY-AUDIT' WHERE id='${id}'`);
    console.log('CSV EXPORT: Unicode customer identifier uses RFC5987 header and remains UTF-8 PASS');
    await sql(`INSERT INTO tests(id,code,name,direction,unit,"isSystem","categoryId","updatedAt") SELECT 'entry-audit-test','AUDIT_CUSTOM','Синтетический тест','HIGHER_IS_BETTER','cm',false,"categoryId",now() FROM tests WHERE code='PWR_CMJ'`);
    await win.loadURL(new URL('/tests/entry-audit-test',club.origin).href);
    await web.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='Архивировать').click(); undefined;`);
    assert.equal(await web.executeJavaScript(`!!document.querySelector('[role="dialog"]')`),true);
    await input('[role="dialog"] input','НЕВЕРНО');
    assert.equal(await web.executeJavaScript(`Array.from(document.querySelectorAll('[role="dialog"] button')).find(e=>e.textContent==='Подтвердить').disabled`),true);
    await input('[role="dialog"] input','АРХИВ');
    await web.executeJavaScript(`Array.from(document.querySelectorAll('[role="dialog"] button')).find(e=>e.textContent==='Подтвердить').click(); undefined;`);
    for(let i=0;i<150;i++){if(await sql(`SELECT deleted_at IS NOT NULL FROM tests WHERE id='entry-audit-test'`)==='t')break;await pause(100);}
    assert.equal(await sql(`SELECT deleted_at IS NOT NULL FROM tests WHERE id='entry-audit-test'`),'t');
    console.log('TEST ARCHIVE UI: wrong confirmation blocked, exact confirmation archives synthetic definition PASS');
    // Server action identity is not an authorization boundary: a captured action
    // must also reject invocation through a public route after logout.
    assert.ok(capturedBody?.length && capturedHeaders,'Server action request capture missing');
    const header=name=>Object.entries(capturedHeaders).find(([key])=>key.toLowerCase()===name)?.[1];
    const action=header('next-action');
    assert.ok(action,'Server action request identity missing');
    const cookies=await web.session.cookies.get({url:club.origin.href});
    for(const cookie of cookies)if(['yp_auth','pasko_demo_capability'].includes(cookie.name))await web.session.cookies.remove(club.origin.href,cookie.name);
    const capture=()=>sql(`SELECT json_agg(r ORDER BY id) FROM test_results r WHERE "playerId"='${id}'`);
    const before=await capture();
    await win.loadURL(new URL('/login',club.origin).href);
    await web.executeJavaScript(`fetch('/login',{method:'POST',headers:${JSON.stringify({'Next-Action':action,'Content-Type':header('content-type')})},body:new Uint8Array(${JSON.stringify([...capturedBody])})}).then(response=>response.text()).then(()=>undefined)`);
    const after=await capture();
    for(const cookie of cookies)await web.session.cookies.set({url:club.origin.href,name:cookie.name,value:cookie.value,httpOnly:cookie.httpOnly,path:cookie.path,sameSite:cookie.sameSite});
    assert.equal(after,before,'Unauthenticated action replay through public /login changed measurements');
    console.log('ALL 16 METRICS: real Team UI, decimal comma, invalid text/NaN/Infinity, exact DB values, one session, BC projection, session repeat and unauthorized action replay PASS');
  } finally {
    await sql(`DELETE FROM player_goals WHERE "playerId"='${id}'; DELETE FROM qc_flags WHERE "testResultId" IN (SELECT id FROM test_results WHERE "playerId"='${id}'); DELETE FROM body_compositions WHERE "playerId"='${id}'; DELETE FROM test_results WHERE "playerId"='${id}'; DELETE FROM test_sessions WHERE "playerId"='${id}'; DELETE FROM players WHERE id='${id}'`);
    await sql(`DELETE FROM tests WHERE id='entry-audit-test'`);
  }
};
