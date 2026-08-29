const assert=require('node:assert/strict');
const crypto=require('node:crypto');

// Fresh disposable navigation cluster ONLY. All passwords/keys remain in memory.
module.exports=async function authRecovery({win,club,sql}) {
  assert.equal(await sql(`SELECT count(*) FROM players`),'0','Auth-only fixture must be fresh');
  assert.equal(await sql(`SELECT string_agg(id,',') FROM local_users`),'nav-admin');
  await sql(`DELETE FROM local_users WHERE id='nav-admin'; DELETE FROM "_SeasonToTeam" WHERE "B"='nav-team'; DELETE FROM teams WHERE id='nav-team'; DELETE FROM seasons WHERE id='nav-season'; DELETE FROM organizations WHERE id='nav-org'`);
  const web=win.webContents,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  for(const cookie of await web.session.cookies.get({url:club.origin.href}))await web.session.cookies.remove(club.origin.href,cookie.name);
  const load=route=>win.loadURL(new URL(route,club.origin).href);
  const password=crypto.randomBytes(24).toString('base64url'),nextPassword=crypto.randomBytes(24).toString('base64url'),finalPassword=crypto.randomBytes(24).toString('base64url');
  const fill=async(selector,value)=>{await web.executeJavaScript(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Input missing');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await pause(20);};
  const button=label=>web.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click();undefined;`);
  async function waitFor(expression) {
    for(let i=0;i<150;i++){if(await web.executeJavaScript(expression))return;await pause(100);}
    const state=await web.executeJavaScript(`({path:location.pathname,title:document.querySelector('h1,h2')?.textContent,error:document.querySelector('.login-error')?.textContent})`);
    // Never inspect input values, recovery code, cookies or full page text here.
    throw Error('Auth UI expectation '+expression+' failed: '+JSON.stringify(state));
  }
  async function submit() {await web.executeJavaScript(`document.querySelector('form').noValidate=true;document.querySelector('form').requestSubmit();undefined;`);}
  await load('/login');
  assert.equal(new URL(web.getURL()).pathname,'/setup');
  await button('Начать настройку');await pause(50);
  await button('Продолжить →');
  await waitFor(`document.body.innerText.includes('Название клуба обязательно.')`);
  await fill('#organizationName','Synthetic Recovery Club');await fill('#organizationShortName','Synthetic');await button('Продолжить →');await pause(50);
  await fill('#teamName','Synthetic Recovery Team');await button('Продолжить →');await pause(50);
  await fill('#seasonName','Synthetic Season');await fill('#startDate','2026-01-01');await fill('#endDate','2027-01-01');await button('Продолжить →');await pause(50);
  await fill('#displayName','Synthetic Admin');await fill('#login','synthetic-admin');await fill('#password','short');await fill('#confirmPassword','short');await submit();
  await waitFor(`document.body.innerText.includes('Пароль должен содержать не менее')`);
  assert.equal(await sql(`SELECT count(*) FROM local_users`),'0','Invalid first run wrote an administrator');
  await fill('#password',password);await fill('#confirmPassword',password);await submit();
  await waitFor(`!!document.querySelector('code')`);
  const recovery=await web.executeJavaScript(`document.querySelector('code').textContent`);
  assert.ok(recovery.startsWith('PASKO-'));
  assert.equal(await sql(`SELECT (SELECT count(*) FROM local_users)||'|'||(SELECT count(*) FROM organizations)||'|'||(SELECT count(*) FROM teams)||'|'||(SELECT count(*) FROM seasons)`),'1|1|1|1');
  await web.executeJavaScript(`document.querySelector('input[type="checkbox"]').click();undefined;`);await button('Я сохранил ключ →');
  await web.executeJavaScript(`document.querySelector('a[href="/login"]').click();undefined;`);await waitFor(`location.pathname==='/login'`);
  async function login(secret,success) {
    await load('/login');await fill('[name="login"]','synthetic-admin');await fill('[name="password"]',secret);await submit();
    await waitFor(success?`location.pathname==='/'`:`location.pathname==='/login' && location.search.includes('error=invalid')`);
  }
  await login('wrong',false);await login(password,true);
  const installation=await web.executeJavaScript(`fetch('/api/diagnostics').then(r=>r.json()).then(d=>d.installationId)`);
  assert.ok(installation);
  await sql(`INSERT INTO players(id,"playerId","firstName","lastName",position,"teamId","updatedAt") SELECT 'auth-data-player','SECURITY-DATA','Synthetic','Preserved','setter',id,now() FROM teams;
    INSERT INTO test_sessions(id,"sessionId","DateTime",phase,"playerId","teamId","seasonId","updatedAt") SELECT 'auth-data-session','SECURITY-DATA',now()-interval '1 day','INSEASON','auth-data-player',t.id,s.id,now() FROM teams t CROSS JOIN seasons s;
    INSERT INTO test_results(id,value,"testId","playerId","testSessionId","qcStatus","updatedAt") SELECT 'auth-data-result',60,id,'auth-data-player','auth-data-session','PASSED',now() FROM tests WHERE code='PWR_CMJ';
    INSERT INTO player_goals(id,"playerId","testId","targetValue","targetDate","updatedAt") SELECT 'auth-data-goal','auth-data-player',id,65,now()+interval '30 day',now() FROM tests WHERE code='PWR_CMJ'`);
  const tables=['organizations','teams','seasons','test_categories','players','tests','norm_profiles','norm_entries','reference_sources','norm_entry_sources','test_sessions','test_results','body_compositions','player_goals','equipment','qc_flags','import_jobs','audit_logs','_SeasonToTeam'];
  const snapshot=()=>sql(`SELECT json_build_object(${tables.map(t=>`'${t}',(SELECT json_agg(row_data ORDER BY row_data::text) FROM (SELECT row_to_json(t) row_data FROM "${t}" t) r)`).join(',')})`);
  const before=await snapshot();
  await load('/setup');assert.equal(new URL(web.getURL()).pathname,'/login','Completed First Run must not restart');
  await load('/recover');
  for(const [name,value] of Object.entries({login:'synthetic-admin',recoveryKey:'WRONG',password:nextPassword,confirmPassword:nextPassword}))await fill(`[name="${name}"]`,value);
  await submit();await waitFor(`document.body.innerText.includes('Неверный логин или ключ восстановления.')`);
  // React resets uncontrolled action-form fields after the rejected submission.
  for(const [name,value] of Object.entries({login:'synthetic-admin',recoveryKey:recovery,password:nextPassword,confirmPassword:nextPassword}))await fill(`[name="${name}"]`,value);
  await submit();await waitFor(`!!document.querySelector('code')`);
  const replacement=await web.executeJavaScript(`document.querySelector('code').textContent`);
  assert.notEqual(replacement,recovery,'Recovery key must rotate');
  assert.equal(await snapshot(),before,'Password recovery changed domain data');
  await login(password,false);await login(nextPassword,true);
  assert.equal(await web.executeJavaScript(`fetch('/api/diagnostics').then(r=>r.json()).then(d=>d.installationId)`),installation);
  const diagnostics=await web.executeJavaScript(`fetch('/api/diagnostics').then(r=>r.text())`);
  for(const secret of [password,nextPassword,recovery,replacement])assert.ok(!diagnostics.includes(secret),'Diagnostics contains synthetic secret');
  await load('/settings');
  for(const [name,value] of Object.entries({currentPassword:'wrong',newPassword:finalPassword,confirmPassword:finalPassword}))await fill(`[name="${name}"]`,value);
  await web.executeJavaScript(`document.querySelector('[name="currentPassword"]').form.requestSubmit();undefined;`);
  await waitFor(`location.search.includes('security=invalid-current')`);
  const errorVisible=await web.executeJavaScript(`document.body.innerText.includes('Текущий пароль неверен.')`);
  await load('/settings');
  for(const [name,value] of Object.entries({currentPassword:nextPassword,newPassword:finalPassword,confirmPassword:finalPassword}))await fill(`[name="${name}"]`,value);
  await web.executeJavaScript(`document.querySelector('[name="currentPassword"]').form.requestSubmit();undefined;`);
  await waitFor(`location.pathname==='/login'`);
  assert.ok(!(await web.session.cookies.get({url:club.origin.href,name:'yp_auth'})).length,'Password change did not clear current auth cookie');
  await login(nextPassword,false);await login(finalPassword,true);
  assert.equal(await snapshot(),before,'Security settings changed domain data');
  console.log('First Run validation + no duplicates + Login + Recovery rotation/data/Installation ID + password change + diagnostics redaction: PASS');
  assert.ok(errorVisible,'Settings does not display invalid-current-password error to the user');
};
