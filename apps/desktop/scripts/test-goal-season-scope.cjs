const assert = require('node:assert/strict');
const crypto = require('node:crypto');
// Actual Electron UI and disposable PostgreSQL regression, never a user DB.
module.exports = async function goalSeasonScope({win,club,sql,auth}) {
  const web=win.webContents;
  const previousContext=(await web.session.cookies.get({url:club.origin.href,name:'pasko_context'}))[0];
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const test=await sql(`SELECT id FROM tests WHERE code='PWR_CMJ'`);
  await sql(`INSERT INTO players(id,"playerId","firstName","lastName",position,"teamId","updatedAt") VALUES ('goal-scope-player','GOAL-SCOPE','Цель','Сезон','setter','nav-team',now());
    INSERT INTO seasons(id,name,"startDate","endDate","updatedAt") VALUES ('goal-scope-season-b','Season B','2025-01-01','2025-12-31',now());
    INSERT INTO "_SeasonToTeam"("A","B") VALUES ('goal-scope-season-b','nav-team');
    INSERT INTO test_sessions(id,"sessionId","DateTime",phase,"playerId","teamId","seasonId","updatedAt") VALUES ('goal-scope-session','GOAL-SCOPE',now()-interval '3 day','INSEASON','goal-scope-player','nav-team','nav-season',now());
    INSERT INTO test_results(id,value,"testId","playerId","testSessionId","qcStatus","updatedAt") VALUES ('goal-scope-result',60,'${test}','goal-scope-player','goal-scope-session','PASSED',now());
    INSERT INTO player_goals(id,"playerId","testId","targetValue","targetDate",achieved,"achievedAt","updatedAt") SELECT 'goal-scope-goal','goal-scope-player','${test}',50,now()+interval '30 day',true,"DateTime",now() FROM test_sessions WHERE id='goal-scope-session'`);
  const rows = () => web.executeJavaScript(`Array.from(document.querySelectorAll('tbody tr')).filter(e=>e.innerText.includes('GOAL-SCOPE')).map(e=>Array.from(e.querySelectorAll('td')).map(c=>c.innerText))`);
  async function recalculate() {
    // Await the real Server Action response, rather than guessing from a timer.
    const response = new Promise((resolve, reject) => {
      const timer=setTimeout(()=>{web.session.webRequest.onCompleted(null);reject(new Error('Goal action response timeout'));},15000);
      web.session.webRequest.onCompleted(event=>{
        if(event.method==='POST' && new URL(event.url).pathname==='/goals') {
          clearTimeout(timer);web.session.webRequest.onCompleted(null);
          if(event.statusCode===200) resolve(); else reject(new Error('Goal action status '+event.statusCode));
        }
      });
    });
    await web.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='Проверить достижения').click(); undefined;`);
    await response;
    await pause(100);
  }
  async function select(seasonId){
    const payload=Buffer.from(JSON.stringify({organizationId:'nav-org',teamId:'nav-team',seasonId})).toString('base64url');
    const token=payload+'.'+crypto.createHmac('sha256',auth).update('PASKO_APP_CONTEXT:v1:'+payload).digest('base64url');
    await web.session.cookies.set({url:club.origin.href,name:'pasko_context',value:token,httpOnly:true,path:'/'});
    await win.loadURL(new URL('/goals',club.origin).href);
  }
  try {
    await select('nav-season');
    const a=await rows();
    const firstAt=await sql(`SELECT "achievedAt" FROM player_goals WHERE id='goal-scope-goal'`);
    await select('goal-scope-season-b');
    const b=await rows();
    assert.equal(a.length,1,'Fixture goal must be rendered');
    assert.deepEqual(b,a,'Empty Season B must show identical cross-season current/status');
    assert.equal(b[0][2],'60 cm');
    await recalculate();
    const achieved=await sql(`SELECT achieved FROM player_goals WHERE id='goal-scope-goal'`);
    assert.equal(achieved,'t','BLOCKER: synchronization in empty Season B cleared achievement obtained in Season A');
    assert.equal(await sql(`SELECT "achievedAt" FROM player_goals WHERE id='goal-scope-goal'`),firstAt);
    const sprint=await sql(`SELECT id FROM tests WHERE code='SPD_10'`);
    await sql(`INSERT INTO player_goals(id,"playerId","testId","targetValue","targetDate","updatedAt") VALUES
      ('goal-scope-higher','goal-scope-player','${test}',65,now()+interval '30 day',now()),
      ('goal-scope-lower','goal-scope-player','${sprint}',1.7,now()+interval '30 day',now());
      INSERT INTO test_sessions(id,"sessionId","DateTime",phase,"playerId","teamId","seasonId","updatedAt") VALUES
      ('goal-scope-b','GOAL-SCOPE-B',now()-interval '2 day','INSEASON','goal-scope-player','nav-team','goal-scope-season-b',now()),
      ('goal-scope-future','GOAL-SCOPE-FUTURE',now()+interval '1 day','INSEASON','goal-scope-player','nav-team','goal-scope-season-b',now());
      INSERT INTO test_results(id,value,"testId","playerId","testSessionId","qcStatus","updatedAt") VALUES
      ('goal-scope-future-high',70,'${test}','goal-scope-player','goal-scope-future','PASSED',now()),
      ('goal-scope-future-low',1.6,'${sprint}','goal-scope-player','goal-scope-future','PASSED',now()),
      ('goal-scope-failed',70,'${test}','goal-scope-player','goal-scope-b','FAILED',now())`);
    await select('nav-season'); await recalculate();
    assert.equal(await sql(`SELECT count(*) FROM player_goals WHERE id IN ('goal-scope-higher','goal-scope-lower') AND achieved`),'0','Future/failed B measurements cannot achieve goals');
    await sql(`UPDATE test_results SET value=65,"qcStatus"='PASSED' WHERE id='goal-scope-failed';
      INSERT INTO test_results(id,value,"testId","playerId","testSessionId","qcStatus","updatedAt") VALUES ('goal-scope-valid-low',1.7,'${sprint}','goal-scope-player','goal-scope-b','PASSED',now())`);
    await recalculate();
    assert.equal(await sql(`SELECT count(*) FROM player_goals g JOIN test_sessions s ON s.id='goal-scope-b' WHERE g.id IN ('goal-scope-higher','goal-scope-lower') AND g.achieved AND g."achievedAt"=s."DateTime"`),'2','Valid Season B results achieve both directions while A is selected');
    await select('nav-season'); const afterA=await rows();
    await select('goal-scope-season-b'); await recalculate(); await select('goal-scope-season-b');
    assert.deepEqual(await rows(),afterA,'Current values/status stable across seasons after achievement');
    assert.equal(await sql(`SELECT "achievedAt" FROM player_goals WHERE id='goal-scope-goal'`),firstAt,'Later qualifying B result cannot rewrite first A achievement');
    console.log('Goals cross-season UI/DB PASS: A → empty B stable; future/FAILED excluded; B higher/lower achieve in A; first measurement timestamp preserved.');
  } finally {
    await web.session.cookies.remove(club.origin.href,'pasko_context');
    if(previousContext) await web.session.cookies.set({url:club.origin.href,name:'pasko_context',value:previousContext.value,httpOnly:true,path:'/'});
    await sql(`DELETE FROM player_goals WHERE "playerId"='goal-scope-player'; DELETE FROM test_results WHERE "playerId"='goal-scope-player'; DELETE FROM test_sessions WHERE "playerId"='goal-scope-player'; DELETE FROM players WHERE id='goal-scope-player'; DELETE FROM "_SeasonToTeam" WHERE "A"='goal-scope-season-b'; DELETE FROM seasons WHERE id='goal-scope-season-b'`);
  }
};
