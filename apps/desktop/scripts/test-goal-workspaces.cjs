const assert=require('node:assert/strict');
const goalScope=require('./test-goal-season-scope.cjs');
module.exports=async function goalWorkspaces({win,club,demo,sql,auth,demoDatabase}) {
  await goalScope({win,club,sql,auth});
  const before=await sql(`SELECT COALESCE(json_agg(g ORDER BY id),'[]') FROM player_goals g`);
  await win.loadURL(club.origin.href);
  await win.webContents.executeJavaScript(`document.querySelector('a[href="/api/demo-enter"]').click();undefined;`);
  for(let i=0;i<150 && (win.webContents.getURL()!==demo.origin.href || win.webContents.isLoading());i++)await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(win.webContents.getURL(),demo.origin.href);
  // Demo deliberately has a fixed visible context; measurements in its second
  // synthetic season must still participate in player-level goals.
  const demoSql=statement=>sql(statement.replaceAll('nav-team','demo-team').replaceAll('nav-season','demo-season-2026-27'),demoDatabase);
  await goalScope({win,club:demo,sql:demoSql,auth});
  assert.equal(await sql(`SELECT COALESCE(json_agg(g ORDER BY id),'[]') FROM player_goals g`),before,'Demo goal recalculation modified Club goals');
  await win.webContents.executeJavaScript(`document.querySelector('a[href="/club-workspace"]').click();undefined;`);
  for(let i=0;i<150 && (win.webContents.getURL()!==club.origin.href || win.webContents.isLoading());i++)await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(win.webContents.getURL(),club.origin.href);
  console.log('Cross-season goals Club/Demo semantics and DB isolation PASS');
};
