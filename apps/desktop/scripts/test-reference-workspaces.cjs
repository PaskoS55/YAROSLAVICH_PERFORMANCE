const assert=require('node:assert/strict');
module.exports=async function referenceWorkspaces({win,club,demo,sql,demoDatabase}) {
  const web=win.webContents,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const before=await sql(`SELECT COALESCE(json_agg(a ORDER BY id),'[]') FROM audit_logs a`);
  await win.loadURL(club.origin.href);
  await web.executeJavaScript(`document.querySelector('a[href="/api/demo-enter"]').click();undefined;`);
  for(let i=0;i<150 && (web.getURL()!==demo.origin.href || web.isLoading());i++)await pause(100);
  assert.equal(web.getURL(),demo.origin.href);
  await win.loadURL(new URL('/norms',demo.origin).href);
  await web.executeJavaScript(`(() => {const checkbox=document.querySelector('input[name="compatibilityConfirmed"]');checkbox.click();checkbox.form.requestSubmit();})()`);
  let saved=false;
  for(let i=0;i<150;i++) {
    const status=await web.executeJavaScript(`({path:location.pathname,saved:document.body.innerText.includes('Совместимость подтверждена для текущей команды и версии профиля.')})`);
    if(status.saved){saved=true;break;}
    if(status.path==='/login')break;
    await pause(100);
  }
  assert.ok(saved,'Demo reference confirmation must not redirect an authenticated Club user to Login');
  assert.equal(await sql(`SELECT COALESCE(json_agg(a ORDER BY id),'[]') FROM audit_logs a`),before,'Demo confirmation wrote to Club AuditLog');
  assert.ok(Number(await sql(`SELECT count(*) FROM audit_logs WHERE action='REFERENCE_PROFILE_COMPATIBILITY_CONFIRMED' AND "entityId"='demo-team'`,demoDatabase))>0);
  await web.executeJavaScript(`document.querySelector('a[href="/club-workspace"]').click();undefined;`);
  for(let i=0;i<150 && (web.getURL()!==club.origin.href || web.isLoading());i++)await pause(100);
  assert.equal(web.getURL(),club.origin.href);
  console.log('Reference confirmation Demo UI + AuditLog + Club isolation PASS');
};
