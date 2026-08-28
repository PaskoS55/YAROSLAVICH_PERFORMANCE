const assert = require('node:assert/strict');

// Uses only the caller's disposable cluster and authenticated Electron window.
module.exports = async function testHistoricalTimeline({ win, club, sql, id }) {
  const web = win.webContents;
  const go = route => win.loadURL(new URL(route, club.origin).href);
  const cards = () => web.executeJavaScript(`Array.from(document.querySelectorAll('main a[href="/sessions"]')).map(e=>e.innerText)`);
  const trend = () => web.executeJavaScript(`document.querySelector('svg[viewBox="0 0 600 240"]')?.outerHTML`);
  const cmj = await sql(`SELECT id FROM tests WHERE code='PWR_CMJ'`);
  await go('/'); const before = await cards(); assert.ok(before.length >= 2);
  await go(`/analytics?playerId=${id}&testId=${cmj}`);
  const historicalTrend = await trend(); assert.ok(historicalTrend);
  await sql(`INSERT INTO test_sessions(id,"sessionId","DateTime",phase,"playerId","teamId","seasonId","updatedAt") VALUES ('timeline-future','timeline-future',now()+interval '1 day','INSEASON','${id}','nav-team','nav-season',now());
    INSERT INTO test_results(id,value,"testId","playerId","testSessionId","qcStatus","updatedAt") VALUES ('timeline-future-result',79.99,'${cmj}','${id}','timeline-future','PASSED',now());
    INSERT INTO player_goals(id,"playerId","testId","targetValue","targetDate","updatedAt") VALUES ('timeline-goal-future','${id}','${cmj}',60,now()+interval '30 days',now()),('timeline-goal-past','${id}','${cmj}',40,now()+interval '30 days',now());`);
  await go('/'); assert.deepEqual(await cards(),before,'Future measurement changed Dashboard counts');
  await go(`/analytics?playerId=${id}&testId=${cmj}`);
  assert.equal(await trend(),historicalTrend,'Future measurement entered trend');
  await go(`/players/${id}`);
  assert.equal(await web.executeJavaScript(`Array.from(document.querySelectorAll('svg text')).some(e=>e.dataset.label==='Мощность 60')`),true,'Future PASSED result changed Profile');
  assert.equal(await web.executeJavaScript(`document.body.innerText.includes('79.99')`),false,'Future measurement entered PB/history');
  await go('/goals');
  assert.equal(await web.executeJavaScript(`Array.from(document.querySelectorAll('tbody tr')).filter(r=>r.querySelector('a')?.getAttribute('href')===${JSON.stringify(`/players/${id}`)}).every(r=>r.cells[2].textContent.trim()==='48 cm')`),true,'Future result shown as current goal performance');
  await web.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='Проверить достижения').click(); undefined;`);
  let completed = false;
  for (let i=0;i<150;i++) {
    if (await sql(`SELECT achieved::text FROM player_goals WHERE id='timeline-goal-past'`) === 'true') { completed = true; break; }
    await new Promise(resolve => setTimeout(resolve,100));
  }
  assert.equal(completed,true,'Real goal synchronization action did not complete');
  assert.equal(await sql(`SELECT achieved::text||'|'||("achievedAt" IS NULL)::text FROM player_goals WHERE id='timeline-goal-future'`),'false|true','Future result achieved goal');
  assert.equal(await sql(`SELECT count(*) FROM test_results WHERE id='timeline-future-result'`),'1','Historical filtering deleted future data');
  await go('/sessions');
  assert.equal(await web.executeJavaScript(`!!document.querySelector('a[href="/sessions/timeline-future"]')`),true,'Session management hid future record');
  console.log('Historical timeline UI PASS: Dashboard closed 30-day window, Profile/PB, Analytics, Goals current/sync, future record preserved in sessions');
};
