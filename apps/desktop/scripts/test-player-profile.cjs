const assert = require('node:assert/strict');
const crypto = require('node:crypto');

module.exports = async function testPlayerProfile({ win, club, demo, sql, auth, demoDatabase }) {
  const web = win.webContents;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function until(predicate, message) {
    for (let i=0;i<150;i++) { if (await predicate()) return; await pause(100); }
    throw Error(message);
  }
  const text = () => web.executeJavaScript('document.body.innerText');
  const navigate = (base, route) => win.loadURL(new URL(route, base).href);
  async function set(selector, value) {
    await web.executeJavaScript(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)throw Error('Missing input'); const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await pause(100);
  }
  const radar = () => web.executeJavaScript(`Array.from(document.querySelectorAll('svg[aria-label="Профиль игрока по категориям"] text')).map(e=>({label:e.dataset.label,description:e.querySelector('title')?.textContent}))`);
  const coverageText = () => web.executeJavaScript(`document.querySelector('[aria-label="Покрытие числовой оценки"]')?.innerText`);
  const unavailable = () => web.executeJavaScript(`Array.from(document.querySelectorAll('h3')).find(e=>e.textContent==='Недоступно для числовой оценки')?.parentElement.innerText`);
  const persisted = () => sql(`SELECT json_build_object('categories',(SELECT json_agg(t ORDER BY id) FROM test_categories t),'tests',(SELECT json_agg(t ORDER BY id) FROM tests t),'results',(SELECT json_agg(t ORDER BY id) FROM test_results t),'sessions',(SELECT json_agg(t ORDER BY id) FROM test_sessions t))::text`);
  const section = heading => web.executeJavaScript(`Array.from(document.querySelectorAll('h2')).find(e=>e.textContent===${JSON.stringify(heading)})?.parentElement.innerText`);
  const demoBefore = await sql('SELECT count(*) FROM test_results', demoDatabase);
  // Manual production workflow through actual forms and Server Actions.
  await navigate(club.origin,'/players/new');
  for (const [name,value] of Object.entries({lastName:'Synthetic',firstName:'Profile',playerId:'PROFILE-UI',position:'setter',birthDate:'1995-01-01'})) await set(`[name="${name}"]`,value);
  await web.executeJavaScript(`document.querySelector('input[name="lastName"]').form.querySelector('button').click(); undefined;`);
  await until(async()=>web.getURL()===new URL('/players',club.origin).href,'Player create did not redirect');
  const id = await sql(`SELECT id FROM players WHERE "playerId"='PROFILE-UI' AND "teamId"='nav-team'`);
  assert.match(id,/^[a-z0-9]+$/);
  for (const [code,value] of [['PWR_CMJ','48'],['SPD_10','1.83'],['AGI_TTEST','9.84'],['STR_SQUAT','150'],['STR_PULL','220']]) {
    const testId = await sql(`SELECT id FROM tests WHERE code='${code}'`);
    await navigate(club.origin,'/testing/team');
    await set('main select',testId);
    await set('input[inputmode="decimal"]',value);
    await until(async()=>(await text()).includes('Введено 1 из 1'),'Controlled result input did not update');
    await web.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='Сохранить результаты').click(); undefined;`);
    await until(async()=>(await text()).includes('Сохранено: 1 из 1'),'Manual result did not save');
  }
  assert.equal(await sql(`SELECT count(*) FROM test_results WHERE "playerId"='${id}' AND "qcStatus"='PASSED' AND source='MANUAL'`),'5');
  await navigate(club.origin,`/players/${id}`);
  assert.equal((await radar()).length,0, 'Unconfirmed system fallback must not create numeric axes');
  assert.match(await unavailable(),/Не подтверждено/);
  assert.match(await text(),/подтвердите соответствие/);
  await navigate(club.origin,'/norms');
  await web.executeJavaScript(`document.querySelector('[name="compatibilityConfirmed"]').click(); document.querySelector('[name="compatibilityConfirmed"]').form.querySelector('button').click(); undefined;`);
  await until(async()=>(await text()).includes('Совместимость подтверждена'),'Reference compatibility confirmation failed');
  await navigate(club.origin,`/players/${id}`);
  let axes = await radar();
  assert.ok(axes.some(r=>/Мощность 60$/.test(r.label)));
  assert.ok(axes.some(r=>/Скорость 39$/.test(r.label)));
  assert.ok(axes.some(r=>/Ловкость 60$/.test(r.label)));
  assert.equal(axes.length,4);
  assert.ok(axes.some(r=>/Волейбол Нет результата$/.test(r.label)));
  assert.match(await unavailable(),/Сила — Нет утверждённого числового референса/);
  assert.match(await unavailable(),/Мобильность и стабильность — Контекстная оценка/);
  assert.ok(axes.filter(r=>!r.label.includes('Нет результата')).every(r=>r.description.includes('Стандартизированный балл по опубликованным среднему и SD')));
  assert.match(await coverageText(),/Мощность — 1\/2/);
  assert.match(await coverageText(),/Ловкость — 1\/2/);
  assert.equal(await web.executeJavaScript(`document.querySelectorAll('[data-series="player"] polygon').length`),0);
  assert.equal(await web.executeJavaScript(`document.querySelectorAll('[data-series="player"] circle').length`),3);
  assert.ok(!(await text()).includes('Нет совместимых данных по категориям профиля.'));
  assert.match(await section('Сильные стороны'),/Мощность/);
  assert.match(await section('Зоны роста'),/Скорость/);
  assert.doesNotMatch(await section('Сильные стороны'),/Скорость/);
  const beforeRead = await persisted();
  const pbBefore = await section('Персональные рекорды');
  await navigate(club.origin,`/players/${id}`);
  assert.equal(await persisted(),beforeRead,'Profile read changed persisted categories/tests/results/sessions');
  assert.equal(await section('Персональные рекорды'),pbBefore,'PB changed');
  // Only this disposable synthetic cluster is modified for compatibility/layout fixtures.
  await sql(`UPDATE players SET "birthDate"=NULL WHERE id='${id}'`);
  await navigate(club.origin,`/players/${id}`);
  assert.equal((await radar()).length,0);
  assert.match(await unavailable(),/дата рождения/);
  assert.equal(await section('Персональные рекорды'),pbBefore,'Compatibility changed PB');
  await sql(`UPDATE players SET "birthDate"='1995-01-01' WHERE id='${id}'`);
  const leftAxisName = await sql(`SELECT name FROM test_categories WHERE code='VOLLEYBALL'`);
  await sql(`UPDATE test_categories SET name='Мобильность и стабильность' WHERE code='VOLLEYBALL'`);
  await navigate(club.origin,`/players/${id}`);
  const [width,height] = win.getSize();
  for (const cardWidth of [216,280,420]) {
    // Constrain the actual card, not just the viewport (desktop navigation has a sidebar).
    const fits = await web.executeJavaScript(`(() => { const svg=document.querySelector('svg[aria-label="Профиль игрока по категориям"]'); svg.parentElement.style.width='${cardWidth}px'; svg.parentElement.style.padding='8px'; const v=svg.viewBox.baseVal; return Array.from(svg.querySelectorAll('text')).every(e=>{const b=e.getBBox();return e.querySelectorAll('tspan').length>0&&b.x>=v.x&&b.y>=v.y&&b.x+b.width<=v.x+v.width&&b.y+b.height<=v.y+v.height;}); })()`);
    assert.equal(fits,true,`Wrapped label clipped at card width ${cardWidth}`);
  }
  win.setSize(width,height);
  await sql(`UPDATE test_categories SET name='${leftAxisName.replaceAll("'","''")}' WHERE code='VOLLEYBALL'`);
  await navigate(club.origin,`/players/${id}`);
  assert.equal(await persisted(),beforeRead,'Synthetic layout fixture did not preserve data');
  console.log('Player Profile: missing vs unsupported vs incompatible, no zero vertices, PB/data preserved, Cyrillic SVG bounds at 216/280/420px PASS');
  console.log('Player Profile: real create/player, manual team-testing forms, compatible reference confirmation, radar/strong/growth/partial categories PASS');

  // Pin a valid current context before introducing an unrelated team/club.
  const payload = Buffer.from(JSON.stringify({organizationId:'nav-org',teamId:'nav-team',seasonId:'nav-season'})).toString('base64url');
  const signed = payload+'.'+crypto.createHmac('sha256',auth).update('PASKO_APP_CONTEXT:v1:'+payload).digest('base64url');
  await web.session.cookies.set({url:club.origin.href,name:'pasko_context',value:signed,httpOnly:true,sameSite:'strict',path:'/'});
  await sql(`INSERT INTO organizations(id,name,code,"updatedAt") VALUES ('profile-other-org','Other Synthetic','OTHER',now());
    INSERT INTO teams(id,name,code,"organizationId","updatedAt") VALUES ('profile-other-team','Other','OTHER','profile-other-org',now());
    INSERT INTO players(id,"playerId","firstName","lastName",position,"teamId","updatedAt") VALUES ('profile-other-player','OTHER','Other','Synthetic','libero','profile-other-team',now());
    INSERT INTO test_sessions(id,"sessionId","DateTime",phase,"playerId","teamId","seasonId","updatedAt") VALUES ('profile-failed','profile-failed','2090-01-01','INSEASON','${id}','nav-team','nav-season',now());
    INSERT INTO test_results(id,value,"testId","playerId","testSessionId","qcStatus","updatedAt") SELECT 'profile-failed-result',100,id,'${id}','profile-failed','FAILED',now() FROM tests WHERE code='PWR_CMJ';`);
  await navigate(club.origin,`/players/${id}`);
  assert.ok((await radar()).some(r=>/Мощность 60$/.test(r.label)), 'Latest FAILED result must not replace last PASSED');
  await navigate(club.origin,'/players/profile-other-player');
  assert.ok((await radar()).length===0,'Foreign club player leaked');
  await navigate(club.origin,'/');
  await web.executeJavaScript(`document.querySelector('a[href="/api/demo-enter"]').click(); undefined;`);
  await until(async()=>web.getURL()===demo.origin.href&&!web.isLoading(),'Demo entry failed');
  await navigate(demo.origin,'/players/demo-player-01');
  axes = await radar();
  assert.ok(axes.some(r=>/Мощность 50$/.test(r.label)));
  assert.ok(axes.some(r=>/Волейбол 51$/.test(r.label)),'Setter-specific reach reference was not used');
  assert.equal(axes.length,4);
  assert.ok(axes.every(r=>/\d+$/.test(r.label)));
  assert.match(await coverageText(),/Мощность — 1\/2/);
  assert.match(await coverageText(),/Волейбол — 2\/3/);
  assert.match(await unavailable(),/Сила|Мобильность и стабильность/);
  assert.doesNotMatch(await section('Сильные стороны'),/Мощность|Волейбол/,'Near-average categories must not be presented as strengths');
  assert.match(await section('Зоны роста'),/Нет категорий с баллом ≤ 40/);
  assert.equal(await sql('SELECT count(*) FROM test_results',demoDatabase),demoBefore,'Production manual actions changed Demo results');
  await navigate(demo.origin,`/players/${id}`);
  assert.equal((await radar()).length,0,'Production player leaked into Demo');
  await navigate(demo.origin,'/players/demo-player-01');
  await web.executeJavaScript(`document.querySelector('a[href="/club-workspace"]').click(); undefined;`);
  await until(async()=>web.getURL()===club.origin.href&&!web.isLoading(),'Club return failed');
  console.log('Player Profile: actual seeded Demo scores, setter references, QC/latest selection, club/team and Demo isolation PASS');
};
