const assert = require('node:assert/strict');

// Diagnostic reproduction: does not silently pick a winner between independently
// stored BodyComposition and TestResult values.
module.exports = async function bodySourceConsistency({ win, club, sql, temp }) {
  const web = win.webContents;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const player = 'body-source-audit';
  await sql(`INSERT INTO players(id,"playerId","firstName","lastName",position,"birthDate","teamId","updatedAt") VALUES ('${player}','BODY-SOURCE','Source','Synthetic','setter','1990-01-01','nav-team',now());
    INSERT INTO test_sessions(id,"sessionId","DateTime",phase,"playerId","teamId","seasonId","updatedAt") VALUES ('body-source-old','body-source-old',now()-interval '2 day','INSEASON','${player}','nav-team','nav-season',now());
    INSERT INTO test_results(id,value,"testId","playerId","testSessionId","qcStatus","updatedAt") SELECT 'body-source-result',90,id,'${player}','body-source-old','PASSED',now() FROM tests WHERE code='BC_MASS';`);
    const yesterday = new Date(Date.now() - 86400000);
    const date = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
  const snapshot = () => sql(`SELECT json_build_object('b',(SELECT json_agg(b ORDER BY id) FROM body_compositions b WHERE "playerId"='${player}'),'r',(SELECT json_agg(r ORDER BY id) FROM test_results r WHERE "playerId"='${player}'),'s',(SELECT json_agg(s ORDER BY id) FROM test_sessions s WHERE "playerId"='${player}'))`);
  async function submit(mass = 92) {
    await win.loadURL(new URL('/body', club.origin).href);
    await web.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='+ Новый замер').click(); undefined;`);
    await pause(150);
    for (const [name,value] of Object.entries({playerId:player,date,mass:String(mass),fat:'15',ffm:'78.2'})) {
      await web.executeJavaScript(`(() => {const e=document.querySelector('[name="${name}"]');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    }
    await web.executeJavaScript(`document.querySelector('[name="mass"]').form.requestSubmit(); undefined;`);
    for (let i=0;i<150;i++) { if (!web.isLoading() && /[?](saved|error)=/.test(web.getURL())) return; await pause(100); }
    throw Error('Body action did not finish');
  }
  try {
    await submit();
    assert.equal(await sql(`SELECT count(*) FROM body_compositions WHERE "playerId"='${player}' AND mass_kg=92`),'1','Real body form must save');
    await win.loadURL(new URL('/body',club.origin).href);
    const body = await web.executeJavaScript(`Array.from(document.querySelectorAll('tbody tr')).find(r=>r.innerText.includes('BODY-SOURCE'))?.innerText`);
    assert.match(body,/92 кг/);
    const testId = await sql(`SELECT id FROM tests WHERE code='BC_MASS'`);
    await win.loadURL(new URL(`/analytics?playerId=${player}&testId=${testId}`,club.origin).href);
    const values = await web.executeJavaScript(`Array.from(document.querySelectorAll('svg[viewBox="0 0 600 240"] g text:first-of-type')).map(e=>e.textContent)`);
    console.log(`BODY SOURCE DIAGNOSTIC: real UI body mass=92; Analytics BC_MASS history=${JSON.stringify(values)}`);
    assert.equal(values.at(-1),'92','BLOCKER: Body measurement and Analytics metric diverge after real form submission');
    const sessionId = await sql(`SELECT "testSessionId" FROM body_compositions WHERE "playerId"='${player}' AND mass_kg=92`);
    const bodyId = await sql(`SELECT id FROM body_compositions WHERE "playerId"='${player}' AND mass_kg=92`);
    const canonical = async () => JSON.parse(await sql(`SELECT json_object_agg(t.code,r.value) FROM test_results r JOIN tests t ON t.id=r."testId" WHERE r."testSessionId"='${sessionId}'`));
    assert.deepEqual(await canonical(),{BC_MASS:92,BC_FAT:15,BC_FFM:78.2});
    await submit(); await submit();
    assert.equal(await sql(`SELECT count(*) FROM body_compositions WHERE "playerId"='${player}'`),'1');
    assert.equal(await sql(`SELECT count(*) FROM test_results WHERE "testSessionId"='${sessionId}'`),'3');
    for (const [table,condition] of [['test_results',`NEW."playerId"='${player}'`],['body_compositions',`NEW."playerId"='${player}'`]]) {
      const before = await snapshot();
      await sql(`CREATE FUNCTION body_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'synthetic rollback'; END IF; RETURN NEW; END $$; CREATE TRIGGER body_audit_fail BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION body_audit_fail();`);
      try { await submit(93); assert.match(web.getURL(),/error=save/); assert.equal(await snapshot(),before,`Rollback after ${table} failure`); }
      finally { await sql(`DROP TRIGGER body_audit_fail ON ${table}; DROP FUNCTION body_audit_fail();`); }
    }
    await sql(`UPDATE body_compositions SET mass_kg=94 WHERE id='${bodyId}'`);
    const conflicting = await snapshot();
    await win.loadURL(new URL('/body',club.origin).href);
    assert.match(await web.executeJavaScript('document.body.innerText'),/Расхождения состава тела/);
    assert.equal(await snapshot(),conflicting,'Read must preserve conflict');
    await submit(95);
    assert.match(web.getURL(),/error=conflict/);
    assert.equal(await snapshot(),conflicting,'Ordinary save must not resolve conflicts');
    async function resolve(choice) {
      await win.loadURL(new URL('/body',club.origin).href);
      await web.executeJavaScript(`document.querySelector('[data-body-conflict="BC_MASS"] button[value="${choice}"]').click(); undefined;`);
      for (let i=0;i<150;i++) { if(!web.isLoading() && /saved=1|error=/.test(web.getURL()))return; await pause(100); }
      throw Error('Conflict action timeout');
    }
    await resolve('test');
    assert.match(web.getURL(),/saved=1/);
    assert.equal(await sql(`SELECT mass_kg FROM body_compositions WHERE id='${bodyId}'`),'92');
    assert.equal((await canonical()).BC_MASS,92);
    await sql(`UPDATE body_compositions SET mass_kg=94 WHERE id='${bodyId}'`);
    await resolve('body');
    assert.match(web.getURL(),/saved=1/);
    assert.equal((await canonical()).BC_MASS,94);
    assert.equal(await sql(`SELECT count(*) FROM audit_logs WHERE action='BODY_METRIC_CONFLICT_RESOLVED' AND "entityId"='${bodyId}'`),'2');
    for (const [code,expected] of Object.entries({BC_MASS:'94',BC_FAT:'15',BC_FFM:'78,2'})) {
      const testId = await sql(`SELECT id FROM tests WHERE code='${code}'`);
      await win.loadURL(new URL(`/analytics?playerId=${player}&testId=${testId}`,club.origin).href);
      const trend = await web.executeJavaScript(`Array.from(document.querySelectorAll('svg[viewBox="0 0 600 240"] g text:first-of-type')).map(e=>e.textContent)`);
      assert.equal(trend.at(-1),expected,`Canonical Dynamics ${code}`);
    }
    console.log('BODY UI: mass/fat/direct FFM atomic writes, repeat submission, rollback both directions, legacy preservation, explicit both choices, AuditLog and Dynamics PASS');
    await require('./test-backup-roundtrip.cjs')({ win, club, sql, temp, player, bodyId });

  } finally {
    await sql(`DELETE FROM body_compositions WHERE "playerId"='${player}'; DELETE FROM test_results WHERE "playerId"='${player}'; DELETE FROM test_sessions WHERE "playerId"='${player}'; DELETE FROM players WHERE id='${player}'`);
  }
};
