const assert = require('node:assert/strict');

// Runs ONLY inside test-workspace-navigation's disposable embedded cluster.
// Expected values are independent of application scoring/selection helpers.
module.exports = async function testCrossScreenMetrics({ win, club, demo, sql, demoDatabase }) {
  const fixtures = {
    STR_PULL: [220, 'HIGHER_IS_BETTER'], STR_SQUAT: [150, 'HIGHER_IS_BETTER'],
    PWR_CMJ: [48, 'HIGHER_IS_BETTER'], PWR_BJ: [250, 'HIGHER_IS_BETTER'],
    SPD_10: [1.82, 'LOWER_IS_BETTER'], SPD_20: [3.22, 'LOWER_IS_BETTER'],
    AGI_TTEST: [10.39, 'LOWER_IS_BETTER'], AGI_505: [2.5, 'LOWER_IS_BETTER'],
    VB_APP: [347, 'HIGHER_IS_BETTER'], VB_BLOCK: [327, 'HIGHER_IS_BETTER'], VB_SERVE: [110, 'HIGHER_IS_BETTER'],
    MOB_OHS: [7, 'CONTEXTUAL'], MOB_SL: [8, 'CONTEXTUAL'],
    BC_MASS: [90, 'CONTEXTUAL'], BC_FAT: [15, 'CONTEXTUAL'], BC_FFM: [76.5, 'CONTEXTUAL'],
  };
  const web = win.webContents;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const navigate = (origin, route) => win.loadURL(new URL(route, origin).href);
  const text = () => web.executeJavaScript('document.body.innerText');
  const axes = () => web.executeJavaScript(`Array.from(document.querySelectorAll('svg[aria-label="Профиль игрока по категориям"] text')).map(e=>e.dataset.label)`);
  const coverage = () => web.executeJavaScript(`document.querySelector('[aria-label="Покрытие числовой оценки"]')?.innerText`);
  const tableRows = () => web.executeJavaScript(`Array.from(document.querySelectorAll('tbody tr')).map(r=>Array.from(r.querySelectorAll('td')).map(c=>c.innerText))`);
  const fmt = n => String(Math.round(n * 100) / 100).replace('.', ',');
  const snapshots = [];
  for (const workspace of ['club', 'demo']) {
    if (workspace === 'demo') {
      await navigate(club.origin, '/');
      await web.executeJavaScript(`document.querySelector('a[href="/api/demo-enter"]').click(); undefined;`);
      for (let i = 0; i < 150 && (web.isLoading() || web.getURL() !== demo.origin.href); i++) await pause(100);
      assert.equal(web.getURL(), demo.origin.href);
    }
    const origin = workspace === 'club' ? club.origin : demo.origin;
    const db = workspace === 'club' ? undefined : demoDatabase;
    const query = statement => sql(statement, db);
    const team = workspace === 'club' ? 'nav-team' : 'demo-team';
    const season = workspace === 'club' ? 'nav-season' : 'demo-season-2026-27';
    const definitions = JSON.parse(await query(`SELECT json_agg(t ORDER BY code) FROM (SELECT id,code,name,unit,direction FROM tests WHERE deleted_at IS NULL) t`));
    assert.deepEqual(definitions.map(t => t.code).sort(), Object.keys(fixtures).sort(), 'Fixture must cover every shipped test');
    const before = await query(`SELECT json_build_object('players',(SELECT count(*) FROM players),'sessions',(SELECT count(*) FROM test_sessions),'results',(SELECT count(*) FROM test_results),'goals',(SELECT count(*) FROM player_goals))`);
    try {
      for (const suffix of ['a', 'b']) {
        const player = `consistency-${suffix}`;
        await query(`INSERT INTO players(id,"playerId","firstName","lastName",position,"birthDate","teamId","updatedAt") VALUES ('${player}','AUDIT-${suffix}','${suffix}','Consistency','setter','1990-01-01','${team}',now())`);
        for (const [stage, offset] of [['old', -2], ['current', -1], ['future', 1]]) {
          const session = `${player}-${stage}`;
          await query(`INSERT INTO test_sessions(id,"sessionId","DateTime",phase,"playerId","teamId","seasonId","updatedAt") VALUES ('${session}','${session}',now()+interval '${offset} day','INSEASON','${player}','${team}','${season}',now())`);
          for (const t of definitions) {
            const [current, direction] = fixtures[t.code];
            assert.equal(t.direction, direction);
            const value = stage === 'future' ? 999 : stage === 'old' ? current + (direction === 'LOWER_IS_BETTER' ? -0.1 : 0.1) : current;
            await query(`INSERT INTO test_results(id,value,"testId","playerId","testSessionId","qcStatus","updatedAt") VALUES ('${session}-${t.code}',${value},'${t.id}','${player}','${session}','PASSED',now())`);
          }
        }
        if (suffix === 'a') for (const t of definitions) {
          await query(`INSERT INTO player_goals(id,"playerId","testId","targetValue","targetDate","updatedAt") VALUES ('consistency-goal-${t.code}','${player}','${t.id}',${fixtures[t.code][0]},now()+interval '30 day',now())`);
        }
        // Backfilled old measurement is written AFTER the current measurement.
        await query(`INSERT INTO body_compositions(id,"playerId","testSessionId",mass_kg,fat_pct,ffm_kg,"createdAt","updatedAt") VALUES
          ('${player}-body-current','${player}','${player}-current',90,15,76.5,now()-interval '1 hour',now()),
          ('${player}-body-old','${player}','${player}-old',91,16,76.4,now(),now())`);
      }
      await navigate(origin, '/players/consistency-a');
      const expectedAxes = ['Мощность 60', 'Скорость 40', 'Ловкость 40', 'Волейбол 60'];
      assert.deepEqual((await axes()).sort(), [...expectedAxes].sort());
      const playerCoverage = await coverage();
      const pbText = await web.executeJavaScript(`Array.from(document.querySelectorAll('h2')).find(e=>e.textContent==='Персональные рекорды').parentElement.innerText`);
      for (const t of definitions) {
        if (t.direction === 'CONTEXTUAL') assert.ok(!pbText.includes(t.name));
        else {
          assert.ok(pbText.includes(t.name));
          const expected = +(fixtures[t.code][0] + (t.direction === 'LOWER_IS_BETTER' ? -0.1 : 0.1)).toFixed(2);
          assert.ok(pbText.includes(`${expected} ${t.unit}`), `PB ${t.code}`);
        }
      }
      for (const t of definitions) {
        await navigate(origin, `/analytics?playerId=consistency-a&testId=${t.id}`);
        assert.deepEqual((await axes()).sort(), [...expectedAxes].sort(), `${workspace} Analytics ${t.code}`);
        assert.equal(await coverage(), playerCoverage);
        const chartValues = await web.executeJavaScript(`Array.from(document.querySelectorAll('svg[viewBox="0 0 600 240"] g text:first-of-type')).map(e=>e.textContent)`);
        assert.equal(chartValues.length, 2, 'Future historical point excluded');
        assert.equal(chartValues.at(-1), fmt(fixtures[t.code][0]), `Trend latest ${t.code}`);
      }
      await navigate(origin, '/compare?a=consistency-a&b=consistency-b');
      const rows = await tableRows();
      for (const t of definitions) {
        const row = rows.find(r => r[0] === t.name);
        assert.ok(row, `Compare includes ${t.code}`);
        for (const index of [1, 2]) assert.ok(row[index].startsWith(`${fmt(fixtures[t.code][0])} ${t.unit}`), `Compare latest ${t.code}`);
      }
      await navigate(origin, '/body');
      const body = (await tableRows()).find(row => row[0].includes('AUDIT-a'));
      assert.ok(body, 'Body fixture row');
      assert.equal(body[2], '90 кг', 'Body latest uses measurement date, not insertion date');
      assert.equal(body[3], '15%');
      assert.equal(body[4], '76,5 кг');
      // Generic test entry accepts extra precision; Body must not round it
      // differently from Dynamics/Compare (the stored values stay unrounded).
      for(const code of ['BC_MASS','BC_FAT','BC_FFM']) {
        const value=fixtures[code][0]+0.125;
        await query(`UPDATE test_results SET value=${value} WHERE id='consistency-a-current-${code}'`);
        await navigate(origin,'/body');
        const cells=(await tableRows()).find(row=>row[0].includes('AUDIT-a'));
        const column={BC_MASS:2,BC_FAT:3,BC_FFM:4}[code];
        assert.ok(cells[column].startsWith(fmt(value)),`Body precision ${code}`);
        const definition=definitions.find(t=>t.code===code);
        await navigate(origin,`/analytics?playerId=consistency-a&testId=${definition.id}`);
        const last=await web.executeJavaScript(`Array.from(document.querySelectorAll('svg[viewBox="0 0 600 240"] g text:first-of-type')).at(-1)?.textContent`);
        assert.equal(last,fmt(value),`Dynamics precision ${code}`);
        await query(`UPDATE test_results SET value=${fixtures[code][0]} WHERE id='consistency-a-current-${code}'`);
      }
      if (workspace === 'club') {
        const csv = await web.executeJavaScript(`fetch('/api/export?type=team').then(async r=>({status:r.status,text:await r.text()}))`);
        assert.equal(csv.status, 200);
        const lines = csv.text.replace(/^\uFEFF/, '').split(/\r?\n/);
        const headers = lines[0].split(';').map(v => v.replace(/^"|"$/g, ''));
        const values = lines.find(line => line.includes('"AUDIT-a"')).split(';');
        for (const t of definitions) assert.equal(values[headers.indexOf(t.code)], String(fixtures[t.code][0]).replace('.', ','), `Export current ${t.code}`);
      }
      await navigate(origin, '/goals');
      const goalRows = await tableRows();
      for (const t of definitions) {
        const row = goalRows.find(r => r[0].includes('AUDIT-a') && r[1] === t.name);
        assert.ok(row, `Goal ${t.code}`);
        assert.equal(row[2], `${fmt(fixtures[t.code][0])} ${t.unit}`);
      }
      await web.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='Проверить достижения').click(); undefined;`);
      for (let i=0;i<150;i++) {
        if (await query(`SELECT count(*) FROM player_goals WHERE "playerId"='consistency-a' AND achieved`) === '11') break;
        await pause(100);
      }
      assert.equal(await query(`SELECT count(*) FROM player_goals WHERE "playerId"='consistency-a' AND achieved`), '11', 'All noncontextual targets reached, contextual remain manual');
      snapshots.push({ axes: expectedAxes, coverage: playerCoverage, latest: rows.map(r => [r[0], r[1], r[2]]) });
      await require('./test-all-pages.cjs')({ win, origin, workspace, testId: definitions[0].id });
      console.log(`All 16 metrics ${workspace}: stored synthetic histories, historical latest, PB, Dynamics, Compare, Goals, profile coverage PASS`);
    } finally {
      await query(`DELETE FROM player_goals WHERE "playerId" IN ('consistency-a','consistency-b'); DELETE FROM body_compositions WHERE "playerId" IN ('consistency-a','consistency-b'); DELETE FROM test_results WHERE "playerId" IN ('consistency-a','consistency-b'); DELETE FROM test_sessions WHERE "playerId" IN ('consistency-a','consistency-b'); DELETE FROM players WHERE id IN ('consistency-a','consistency-b')`);
      assert.equal(await query(`SELECT json_build_object('players',(SELECT count(*) FROM players),'sessions',(SELECT count(*) FROM test_sessions),'results',(SELECT count(*) FROM test_results),'goals',(SELECT count(*) FROM player_goals))`), before);
    }
  }
  assert.deepEqual(snapshots[0], snapshots[1], 'Equivalent Club/Demo fixtures must have identical semantics');
  await navigate(demo.origin, '/');
  await web.executeJavaScript(`document.querySelector('a[href="/club-workspace"]').click(); undefined;`);
  for (let i=0;i<150 && (web.isLoading() || web.getURL()!==club.origin.href);i++) await pause(100);
  assert.equal(web.getURL(),club.origin.href);
  console.log('EVERY-METRIC CROSS-SCREEN + CLUB/DEMO PARITY: PASS');
};
