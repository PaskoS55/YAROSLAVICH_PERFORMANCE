const assert = require('node:assert/strict');
module.exports = async function dataScale({win,club,sql}) {
  await sql(`INSERT INTO players(id,"playerId","firstName","lastName",position,"birthDate","teamId","updatedAt") SELECT 'scale-audit-'||n,'SCALE-'||n,'Александр','Константинопольский-Преображенский '||n,'setter','1990-01-01','nav-team',now() FROM generate_series(1,100) n;
    INSERT INTO test_sessions(id,"sessionId","DateTime",phase,"playerId","teamId","seasonId","updatedAt") SELECT p.id||'-s'||n,p.id||'-s'||n,now()-make_interval(days=>n),'INSEASON',p.id,'nav-team','nav-season',now() FROM players p CROSS JOIN generate_series(1,4) n WHERE p.id LIKE 'scale-audit-%';
    INSERT INTO test_results(id,value,"testId","playerId","testSessionId","qcStatus","updatedAt") SELECT s.id||'-'||t.code,(t."qcMin"+t."qcMax")/2,t.id,s."playerId",s.id,'PASSED',now() FROM test_sessions s CROSS JOIN tests t WHERE s."playerId" LIKE 'scale-audit-%' AND t.deleted_at IS NULL;`);
  const times=[];
  try {
    assert.equal(await sql(`SELECT count(*) FROM test_results WHERE "playerId" LIKE 'scale-audit-%'`),'6400');
    for(const route of ['/','/players','/players/scale-audit-1','/analytics?playerId=scale-audit-1','/compare?a=scale-audit-1&b=scale-audit-2','/reports']) {
      const start=performance.now();await win.loadURL(new URL(route,club.origin).href);
      const elapsed=Math.round(performance.now()-start);times.push({route,ms:elapsed});
      const text=await win.webContents.executeJavaScript('document.body.innerText');
      assert.doesNotMatch(text,/Application error|PrismaClient|Internal Server Error/);
      assert.ok(elapsed<15000,'Severe page-load stall under synthetic 100-player workload');
    }
    console.log('SCALE SMOKE: 100 players / 400 sessions / 6400 results: '+JSON.stringify(times));
  } finally {
    await sql(`DELETE FROM test_results WHERE "playerId" LIKE 'scale-audit-%'; DELETE FROM test_sessions WHERE "playerId" LIKE 'scale-audit-%'; DELETE FROM players WHERE id LIKE 'scale-audit-%'`);
  }
};
