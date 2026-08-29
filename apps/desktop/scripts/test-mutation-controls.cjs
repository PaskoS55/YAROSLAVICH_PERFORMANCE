const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// Own disposable navigation cluster only. Exercise actual forms and count DB rows.
module.exports = async function testMutationControls({win,club,sql,auth}) {
  const web=win.webContents;
  const previous=(await web.session.cookies.get({url:club.origin.href,name:'pasko_context'}))[0];
  const payload=Buffer.from(JSON.stringify({organizationId:'nav-org',teamId:'nav-team',seasonId:'nav-season'})).toString('base64url');
  const token=payload+'.'+crypto.createHmac('sha256',auth).update('PASKO_APP_CONTEXT:v1:'+payload).digest('base64url');
  await web.session.cookies.set({url:club.origin.href,name:'pasko_context',value:token,httpOnly:true,path:'/'});
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const failures=[];
  const load=route=>win.loadURL(new URL(route,club.origin).href);
  async function submit(selector,values) {
    const done=new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{web.session.webRequest.onCompleted(null);reject(Error('Mutation response timeout'));},15000);
      web.session.webRequest.onCompleted(e=>{if(e.method==='POST') {clearTimeout(timeout);web.session.webRequest.onCompleted(null);resolve(e.statusCode);}});
    });
    await web.executeJavaScript(`(() => {
      const form=${selector}; if(!form)throw Error('Form missing');
      for(const [key,value] of Object.entries(${JSON.stringify(values)})) {
        const input=form.elements.namedItem(key); if(!input)throw Error('Input missing '+key);
        const prototype=input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,value);
        input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
      }
      form.noValidate=true;form.requestSubmit();
    })()`);
    const status=await done;await pause(150);
    assert.ok(status<400,'Server action failed: '+status);
  }
  try {
    await load('/team');
    await submit(`document.querySelector('input[name="firstName"]').form`,{playerId:'MUTATION-AUDIT',firstName:'Контроль',lastName:'Действий',position:'setter',height:'-1'});
    if(await sql(`SELECT count(*) FROM players WHERE "playerId"='MUTATION-AUDIT'`)!=='0') failures.push('Team create accepted invalid height -1');
    await sql(`DELETE FROM players WHERE "playerId"='MUTATION-AUDIT'`);
    await load('/team');
    await submit(`document.querySelector('input[name="firstName"]').form`,{playerId:'MUTATION-AUDIT',firstName:'Контроль',lastName:'Действий',position:'setter',height:'190'});
    const player=await sql(`SELECT id FROM players WHERE "playerId"='MUTATION-AUDIT'`);
    assert.ok(player);
    const test=await sql(`SELECT id FROM tests WHERE code='PWR_CMJ'`);
    const goal={playerId:player,testId:test,targetValue:'50',targetDate:'2030-01-01'};
    for(let i=0;i<2;i++) {
      await load('/goals');
      await web.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Новая цель')).click();undefined;`);
      await pause(50);
      await submit(`document.querySelector('input[name="targetValue"]').form`,goal);
    }
    if(await sql(`SELECT count(*) FROM player_goals WHERE "playerId"='${player}'`)!=='1') failures.push('Repeated identical goal form creates duplicates');
    for(let i=0;i<2;i++) {
      await load('/settings');
      await submit(`Array.from(document.querySelectorAll('form')).find(f=>f.querySelector('button')?.textContent.trim()==='Создать сезон')`,{name:'MUTATION AUDIT SEASON',startDate:'2025-01-01',endDate:'2025-12-31'});
    }
    if(await sql(`SELECT count(*) FROM seasons WHERE name='MUTATION AUDIT SEASON'`)!=='1') failures.push('Repeated identical season form creates duplicates');
    const stats=async()=>{
      await load('/');
      return web.executeJavaScript(`Object.fromEntries(Array.from(document.querySelectorAll('main a')).filter(a=>a.querySelector('[class*="text-4xl"]')).map(a=>[a.querySelector('span').textContent,{value:Number(a.querySelector('[class*="text-4xl"]').textContent),text:a.innerText}]))`);
    };
    const before=await stats();
    const second=await sql(`SELECT id FROM tests WHERE code='PWR_BJ'`);
    await sql(`INSERT INTO test_sessions(id,"sessionId","DateTime",phase,"playerId","teamId","seasonId","updatedAt",deleted_at) VALUES
      ('mutation-recent','MUTATION-RECENT',now()-interval '1 day','INSEASON','${player}','nav-team','nav-season',now(),null),
      ('mutation-old','MUTATION-OLD',now()-interval '31 day','INSEASON','${player}','nav-team','nav-season',now(),null),
      ('mutation-future','MUTATION-FUTURE',now()+interval '1 day','INSEASON','${player}','nav-team','nav-season',now(),null),
      ('mutation-deleted','MUTATION-DELETED',now()-interval '2 day','INSEASON','${player}','nav-team','nav-season',now(),now());
      INSERT INTO test_results(id,value,"testId","playerId","testSessionId","qcStatus","updatedAt",deleted_at) VALUES
      ('mutation-r1',45,'${test}','${player}','mutation-recent','PASSED',now(),null),
      ('mutation-r2',99,'${second}','${player}','mutation-recent','FAILED',now(),now()),
      ('mutation-r3',44,'${test}','${player}','mutation-old','PASSED',now(),null),
      ('mutation-r4',80,'${test}','${player}','mutation-future','PASSED',now(),null),
      ('mutation-r5',40,'${test}','${player}','mutation-deleted','PASSED',now(),null)`);
    const after=await stats();
    assert.equal(after['Сессий проведено'].value-before['Сессий проведено'].value,2,'Historical Dashboard session delta');
    assert.equal(after['Результатов записано'].value-before['Результатов записано'].value,2,'Historical nondeleted result delta');
    const recent=await web.executeJavaScript(`Array.from(document.querySelectorAll('tbody tr')).find(r=>r.innerText.includes('MUTATION-RECENT'))?.cells[2].textContent.trim()`);
    if(recent!=='1 тест')failures.push('Dashboard recent-session count includes deleted result');
    await load('/sessions?q=MUTATION-RECENT');
    const count=await web.executeJavaScript(`Array.from(document.querySelectorAll('tbody tr')).find(r=>r.innerText.includes('MUTATION-RECENT'))?.cells[3].textContent.trim()`);
    if(count!=='1')failures.push('Sessions list counts deleted result unlike session details');
    const goalsBefore=(await stats())['Целей в работе'].value;
    await sql(`UPDATE players SET deleted_at=now() WHERE id='${player}'`);
    if((await stats())['Целей в работе'].value!==goalsBefore-1)failures.push('Dashboard active goals includes archived player unlike Goals page');
    await sql(`UPDATE players SET deleted_at=null WHERE id='${player}'`);
    let capturedBody,capturedHeaders;
    web.session.webRequest.onBeforeRequest((event,callback)=>{
      if(event.method==='POST' && new URL(event.url).pathname==='/players/new' && event.uploadData)capturedBody=Buffer.concat(event.uploadData.map(part=>part.bytes??Buffer.alloc(0)));
      callback({});
    });
    web.session.webRequest.onBeforeSendHeaders((event,callback)=>{
      if(event.method==='POST' && new URL(event.url).pathname==='/players/new')capturedHeaders=event.requestHeaders;
      callback({requestHeaders:event.requestHeaders});
    });
    await load('/players/new');
    await submit(`document.querySelector('input[name="firstName"]').form`,{playerId:'',firstName:'RetryFixture',lastName:'MutationAuto',position:'setter',height:'190'});
    web.session.webRequest.onBeforeRequest(null);web.session.webRequest.onBeforeSendHeaders(null);
    assert.ok(capturedBody?.length && capturedHeaders,'Real create-player POST capture required');
    const header=name=>Object.entries(capturedHeaders).find(([key])=>key.toLowerCase()===name)?.[1];
    await web.executeJavaScript(`fetch('/players/new',{method:'POST',headers:${JSON.stringify({'Next-Action':header('next-action'),'Content-Type':header('content-type')})},body:new Uint8Array(${JSON.stringify([...capturedBody])})}).then(r=>r.text()).then(()=>undefined)`);
    if(await sql(`SELECT count(*) FROM players WHERE "firstName"='RetryFixture' AND "lastName"='MutationAuto'`)!=='1')failures.push('Retry of the same auto-code Player POST creates a second player');
    console.log('Mutation control audit:',JSON.stringify(failures));
    assert.deepEqual(failures,[]);
  } finally {
    web.session.webRequest.onCompleted(null);
    web.session.webRequest.onBeforeRequest(null);web.session.webRequest.onBeforeSendHeaders(null);
    await web.session.cookies.remove(club.origin.href,'pasko_context');
    if(previous)await web.session.cookies.set({url:club.origin.href,name:'pasko_context',value:previous.value,httpOnly:true,path:'/'});
    await sql(`DELETE FROM player_goals WHERE "playerId" IN (SELECT id FROM players WHERE "playerId"='MUTATION-AUDIT');
      DELETE FROM test_results WHERE "playerId" IN (SELECT id FROM players WHERE "playerId"='MUTATION-AUDIT');
      DELETE FROM test_sessions WHERE "playerId" IN (SELECT id FROM players WHERE "playerId"='MUTATION-AUDIT');
      DELETE FROM players WHERE "playerId"='MUTATION-AUDIT';
      DELETE FROM players WHERE "firstName"='RetryFixture' AND "lastName"='MutationAuto';
      DELETE FROM "_SeasonToTeam" WHERE "A" IN (SELECT id FROM seasons WHERE name='MUTATION AUDIT SEASON');
      DELETE FROM seasons WHERE name='MUTATION AUDIT SEASON'`);
  }
};
