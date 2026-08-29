const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// Actual Backup link and Restore React dialog. Only the caller's disposable
// cluster and synthetic admin are used. No password leaves process memory.
module.exports = async function backupRoundtrip({ win, club, sql, temp, player, bodyId }) {
  const web = win.webContents;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const password = crypto.randomBytes(24).toString('base64url');
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32, { N:32768,r:8,p:1,maxmem:64*1024*1024 });
  const hash = `scrypt$v1$N=32768,r=8,p=1$${salt.toString('base64url')}$${key.toString('base64url')}`;
  await sql(`UPDATE local_users SET password_hash='${hash}' WHERE id='nav-admin'`);
  await sql(`UPDATE body_compositions SET mass_kg=96 WHERE id='${bodyId}'`);
  const tables=['organizations','teams','seasons','test_categories','players','tests','norm_profiles','norm_entries','reference_sources','norm_entry_sources','test_sessions','test_results','body_compositions','player_goals','equipment','qc_flags','import_jobs','audit_logs','_SeasonToTeam'];
  const state = () => sql(`SELECT json_build_object(${tables.map(table=>`'${table}',(SELECT json_agg(row_data ORDER BY row_data::text) FROM (SELECT row_to_json(t) row_data FROM "${table}" t) rows)`).join(',')})`);
  const before = await state();
  async function unchanged(message) {
    const expected=JSON.parse(before),actual=JSON.parse(await state());
    const changed=tables.flatMap(table=>{
      const a=actual[table] ?? [],b=expected[table] ?? [];
      if(a.length!==b.length)return [`${table}: row count`];
      return a.flatMap((row,index)=>Object.keys(row).filter(key=>JSON.stringify(row[key])!==JSON.stringify(b[index]?.[key])).map(key=>`${table}/${row.id ?? index}/${key}`));
    });
    assert.deepEqual(changed,[],message);
  }
  const adminBefore = await sql(`SELECT json_agg(u ORDER BY id) FROM local_users u`);
  await win.loadURL(new URL('/settings',club.origin).href);
  const downloadPath = path.join(temp,'synthetic-backup.json');
  const downloaded = new Promise((resolve,reject) => web.session.once('will-download', (_event,item) => {
    item.setSavePath(downloadPath);
    item.once('done',(_event,state) => state==='completed' ? resolve() : reject(Error('Backup download failed')));
  }));
  await web.executeJavaScript(`document.querySelector('a[href="/api/backup"]').click(); undefined;`);
  await downloaded;
  const backupText = fs.readFileSync(downloadPath,'utf8');
  const backup = JSON.parse(backupText);
  assert.equal(backup.manifest.authDataIncluded,false);
  assert.ok(!backupText.includes(hash) && !backupText.includes(password));
  const fill = (selector,value) => web.executeJavaScript(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  async function select(text) {
    await win.loadURL(new URL('/settings',club.origin).href);
    await web.executeJavaScript(`(() => {const input=document.querySelector('input[type="file"]');const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(text)}],'synthetic.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    for(let i=0;i<100;i++){ if(await web.executeJavaScript(`!!document.querySelector('[role="dialog"]')`))return; await pause(50); }
    throw Error('Restore dialog missing');
  }
  async function restore(text,secret=password) {
    await select(text);
    await fill('#restore-confirmation','НЕВЕРНО');
    assert.equal(await web.executeJavaScript(`Array.from(document.querySelectorAll('[role="dialog"] button')).find(e=>e.textContent.trim()==='Восстановить').disabled`),true);
    await fill('#restore-confirmation','ВОССТАНОВИТЬ'); await fill('#restore-password',secret);
    await web.executeJavaScript(`Array.from(document.querySelectorAll('[role="dialog"] button')).find(e=>e.textContent.trim()==='Восстановить').click(); undefined;`);
    for(let i=0;i<200;i++) {
      const message=await web.executeJavaScript(`Array.from(document.querySelectorAll('p.text-green-700,p.text-red-600')).map(e=>e.textContent).join(' ')`);
      if(message)return message; await pause(100);
    }
    throw Error('Restore did not report completion');
  }
  await select(backupText);
  await fill('#restore-confirmation','ВОССТАНОВИТЬ');
  await web.executeJavaScript(`Array.from(document.querySelectorAll('[role="dialog"] button')).find(e=>e.textContent.trim()==='Отмена').click(); undefined;`);
  assert.equal(await web.executeJavaScript(`document.querySelector('input[type="file"]').value`),'');
  assert.equal(await state(),before,'Cancel changed data');
  for(const [text,secret] of [ ['{',password], ['null',password], [JSON.stringify({...backup,players:[null]}),password], [JSON.stringify({...backup,product:'UNRELATED'}),password], [JSON.stringify({...backup,sportVertical:'OTHER'}),password], [JSON.stringify({...backup,formatVersion:999}),password], [JSON.stringify({...backup,players:backup.players.map(p=>p.id===player?{...p,teamId:'missing-team'}:p)}),password], [backupText,'wrong-synthetic-password'] ]) {
    const error = await restore(text,secret);
    assert.doesNotMatch(error,/^Восстановлено:|Не удалось выполнить запрос/,'Malformed payload must receive a structured rejection');
    assert.equal(await state(),before,'Rejected backup changed data');
  }
  // A valid backup that fails during insertion must roll back prior DELETEs.
  await sql(`CREATE FUNCTION restore_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic restore rollback'; END $$; CREATE TRIGGER restore_audit_fail BEFORE INSERT ON body_compositions FOR EACH ROW EXECUTE FUNCTION restore_audit_fail();`);
  try { assert.doesNotMatch(await restore(backupText),/^Восстановлено:/); assert.equal(await state(),before,'Restore rollback failed'); }
  finally { await sql(`DROP TRIGGER restore_audit_fail ON body_compositions; DROP FUNCTION restore_audit_fail();`); }
  await sql(`UPDATE test_results SET value=value+1 WHERE "playerId"='${player}'; UPDATE body_compositions SET mass_kg=99 WHERE id='${bodyId}'`);
  assert.notEqual(await state(),before);
  assert.match(await restore(backupText),/^Восстановлено:/);
  await unchanged('Roundtrip altered synchronized or unresolved legacy values');
  assert.equal(await sql(`SELECT json_agg(u ORDER BY id) FROM local_users u`),adminBefore,'Restore changed local authentication');
  await win.loadURL(new URL('/settings',club.origin).href);
  await web.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='Сбросить данные').click(); undefined;`);
  await pause(250);
  assert.equal(await web.executeJavaScript(`!!document.querySelector('[role="dialog"]')`),true,'Reset must show a supported confirmation dialog before changing any data');
  await fill('#reset-confirmation','НЕВЕРНО');
  assert.equal(await web.executeJavaScript(`document.querySelector('[role="dialog"] button[type="submit"]').disabled`),true);
  await web.executeJavaScript(`Array.from(document.querySelectorAll('[role="dialog"] button')).find(e=>e.textContent==='Отмена').click(); undefined;`);
  assert.equal(await state(),before,'Reset Cancel changed data');
  await web.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='Сбросить данные').click(); undefined;`);
  await fill('#reset-confirmation','СБРОСИТЬ');
  await sql(`CREATE FUNCTION reset_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic reset rollback'; END $$; CREATE TRIGGER reset_audit_fail BEFORE DELETE ON players FOR EACH ROW EXECUTE FUNCTION reset_audit_fail();`);
  try {
    await web.executeJavaScript(`document.querySelector('[role="dialog"] button[type="submit"]').click(); undefined;`);
    for(let i=0;i<150;i++){if((await web.executeJavaScript('document.body.innerText')).includes('Не удалось сбросить данные'))break;await pause(100);}
    assert.match(await web.executeJavaScript('document.body.innerText'),/Не удалось сбросить данные/);
    assert.equal(await state(),before,'Reset failure did not roll back all tables');
  } finally {await sql(`DROP TRIGGER reset_audit_fail ON players; DROP FUNCTION reset_audit_fail();`);}
  await web.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='Сбросить данные').click(); undefined;`);
  await fill('#reset-confirmation','СБРОСИТЬ');
  await web.executeJavaScript(`document.querySelector('[role="dialog"] button[type="submit"]').click(); undefined;`);
  for(let i=0;i<150;i++){ if(await sql(`SELECT count(*) FROM players`)==='0')break;await pause(100); }
  assert.equal(await sql(`SELECT count(*) FROM players`),'0');
  assert.match(await restore(backupText),/^Восстановлено:/);
  await unchanged('Backup -> Reset -> Restore changed data');
  console.log('BACKUP/RESTORE UI: Cancel, wrong confirmation/password, malformed/version/FK, rollback, destructive-change roundtrip preserving BC conflicts and LocalUser PASS');
};
