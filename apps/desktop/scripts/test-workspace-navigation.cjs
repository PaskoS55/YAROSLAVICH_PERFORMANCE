// Actual Electron + production standalone Next, with disposable synthetic data.
// No production environment, private signing material or user database is read.
const { app, BrowserWindow, session } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { once } = require('node:events');
const { startPackagedDatabase } = require('../dist/main/packaged-database.js');
const { startPackagedNext } = require('../dist/main/packaged-next.js');
const { resolvePackagedRuntime } = require('../dist/main/runtime-paths.js');
const { installWindowNavigation } = require('../dist/main/window-navigation.js');
const { executeSql, APPLICATION_USER, DEFAULT_DATABASE, DEMO_DATABASE } = require('../dist/main/postgres.js');
const repo = path.resolve(__dirname, '../../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pasko-workspace-navigation-'));
app.setPath('userData', path.join(temp, 'electron'));
app.on('window-all-closed', () => {});
let database, club, demo, win;
const credentials = { bootstrapPassword: crypto.randomBytes(32).toString('hex'), applicationPassword: crypto.randomBytes(32).toString('hex') };
const auth = crypto.randomBytes(32).toString('hex');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function at(url) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (win.webContents.getURL() === url && !win.webContents.isLoading()) return;
    await wait(100);
  }
  throw new Error(`Navigation did not reach ${new URL(url).pathname} on its trusted origin`);
}
async function click(selector) {
  // Exercise the real AppShell anchor/form rather than navigating to an API ourselves.
  await win.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(selector)}).click(); undefined;`);
}
async function stopRuntime(runtime) {
  if (!runtime) return;
  const exited = once(runtime.process, 'exit'); runtime.stop(); await exited;
}
async function main() {
  await app.whenReady();
  assert.equal(JSON.parse(fs.readFileSync(path.join(repo, 'packages/core/product-identity.json'))).licensingEnforcement, false);
  const resourcesPath = path.join(repo, 'apps/desktop/.runtime');
  const runtime = resolvePackagedRuntime(resourcesPath);
  const source = { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, AUTH_SESSION_SECRET: auth, PASKO_INSTALLATION_ID: crypto.randomUUID(), PASKO_PRODUCT_VERSION: '1.0.0', PASKO_LICENSE_STATE: 'UNLICENSED' };
  database = await startPackagedDatabase({ resourcesPath, localAppData: temp, dataRoot: temp, source, licensingEnforcement: false, credentialsProvider: { getCredentials: async () => credentials } });
  assert.ok(database.demoDatabaseUrl);
  const sql = (text, name = DEFAULT_DATABASE) => executeSql({ runtime: database.postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: name, sql: text });
  await sql(`INSERT INTO local_users(id,"displayName",login,login_normalized,password_hash,recovery_key_hash,created_at,updated_at) VALUES ('nav-admin','Synthetic Admin','nav-admin','nav-admin','synthetic-only','synthetic-only',now(),now());
    INSERT INTO organizations(id,name,code,"updatedAt") VALUES ('nav-org','Synthetic Navigation Club','NAV',now());
    INSERT INTO teams(id,name,code,"organizationId","updatedAt") VALUES ('nav-team','Synthetic Team','NAV','nav-org',now());
    INSERT INTO seasons(id,name,"startDate","endDate","updatedAt") VALUES ('nav-season','Synthetic Season','2026-01-01','2027-01-01',now());
    INSERT INTO "_SeasonToTeam"("A","B") VALUES ('nav-season','nav-team');`);
  const counts = `SELECT (SELECT count(*) FROM organizations),(SELECT count(*) FROM teams),(SELECT count(*) FROM players),(SELECT count(*) FROM test_sessions),(SELECT count(*) FROM test_results),(SELECT count(*) FROM local_users);`;
  const clubBefore = await sql(counts); const demoBefore = await sql(counts, DEMO_DATABASE);
  club = await startPackagedNext(runtime.serverPath, database.databaseUrl, source);
  demo = await startPackagedNext(runtime.serverPath, database.demoDatabaseUrl, { ...source, PASKO_WORKSPACE: 'demo', PASKO_DEMO_DATASET_VERSION: '1.0' });
  const now = Date.now(); const payload = Buffer.from(JSON.stringify({ version: 1, userId: 'nav-admin', issuedAt: now, expiresAt: now + 3600000 })).toString('base64url');
  const token = payload + '.' + crypto.createHmac('sha256', auth).update('PASKO_AUTH_SESSION_V1\0' + payload).digest('hex');
  const setSession = () => session.defaultSession.cookies.set({ url: club.origin.href, name: 'yp_auth', value: token, httpOnly: true, sameSite: 'strict', path: '/' });
  await setSession();
  win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, devTools: false } });
  const contents = win.webContents; const redirects = []; const completed = []; const external = [];
  contents.session.webRequest.onBeforeRedirect((event) => { if (event.resourceType === 'mainFrame') redirects.push({ from: new URL(event.url), to: new URL(event.redirectURL), status: event.statusCode }); });
  contents.session.webRequest.onCompleted((event) => { if (event.resourceType === 'mainFrame') completed.push(new URL(event.url)); });
  installWindowNavigation(contents, club.origin, demo.origin, (url) => external.push(url));
  await win.loadURL(club.origin.href); await at(club.origin.href);
  const enter = async () => { await click('a[href="/api/demo-enter"]'); await at(demo.origin.href); };
  await enter();
  const cookies = await contents.session.cookies.get({ url: demo.origin.href });
  assert.ok(cookies.find(c => c.name === 'yp_auth')?.value === token, 'Shared auth cookie was not preserved');
  assert.ok(cookies.some(c => c.name === 'pasko_demo_capability' && c.httpOnly));
  assert.match(await contents.executeJavaScript('document.body.innerText'), /PASKO Demo Volleyball/);
  await click('a[href="/club-workspace"]'); await at(club.origin.href);
  console.log('Demo entry via real AppShell -> authenticated separate Demo -> Club: PASS');
  for (const workspace of ['demo', 'club']) {
    if (workspace === 'demo') await enter();
    else { await setSession(); await win.loadURL(club.origin.href); await at(club.origin.href); }
    await click('form[action="/api/auth/logout"] button'); await at(new URL('/login', club.origin).href);
    const after = await contents.session.cookies.get({ url: club.origin.href });
    assert.ok(!after.some(c => ['yp_auth', 'pasko_demo_capability'].includes(c.name)));
    assert.equal(contents.navigationHistory.canGoBack(), false);
    await win.loadURL(new URL('/players', club.origin).href); await at(new URL('/login', club.origin).href);
    assert.equal(contents.navigationHistory.canGoBack(), false);
    console.log(`${workspace} logout -> club Login, cookies cleared, Back/direct protected route rejected: PASS`);
  }
  assert.ok(redirects.some(r => r.from.pathname === '/api/demo-enter' && r.status === 307 && r.to.pathname === '/demo-workspace'));
  assert.ok(redirects.some(r => r.from.pathname === '/api/auth/logout' && r.status === 303 && r.to.pathname === '/login'));
  for (const url of [...completed, ...redirects.map(r => r.to)]) assert.ok([club.origin.origin, demo.origin.origin].includes(url.origin), 'Navigation escaped trusted runtime origins');
  await contents.executeJavaScript(`location.href='http://localhost:${club.origin.port}/players'; undefined;`); await wait(250);
  assert.equal(contents.getURL(), new URL('/login', club.origin).href);
  await contents.executeJavaScript(`window.open('https://example.com/'); undefined;`); await wait(100);
  assert.deepEqual(external, ['https://example.com/']);
  assert.equal(BrowserWindow.getAllWindows().length, 1);
  assert.equal(contents.isDevToolsOpened(), false);
  assert.equal(await sql(counts), clubBefore); assert.equal(await sql(counts, DEMO_DATABASE), demoBefore);
  console.log('307/303 redirects stay on exact origins; foreign origin blocked; popup denied; production/demo DB unchanged; licensing OFF: PASS');
}
(async () => {
  let code = 0;
  try { await main(); console.log('PACKAGED-EQUIVALENT WORKSPACE NAVIGATION: PASS'); }
  catch (error) { code = 1; console.error('WORKSPACE NAVIGATION FAILED:', error.message); }
  finally {
    if (win && !win.isDestroyed()) win.destroy();
    await stopRuntime(demo); await stopRuntime(club);
    if (database) await database.stop();
    assert.equal(path.dirname(temp), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('pasko-workspace-navigation-'));
    // Chromium cache handles close only when Electron exits. Parent removes this root.
    console.log('DISPOSABLE_ROOT=' + temp);
    app.exit(code);
  }
})();
