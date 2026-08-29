const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

// Actual rendered layout/read smoke, NOT a substitute for mutation tests.
module.exports = async function testAllPages({ win, origin, workspace, testId }) {
  const repo = path.resolve(__dirname, '../../..');
  const tracked = execFileSync('git', ['ls-files', 'apps/web/app'], { cwd: repo, encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/);
  const routes = tracked.filter(file => file.endsWith('/page.tsx')).map(file => {
    let route = file.slice('apps/web/app'.length, -'/page.tsx'.length) || '/';
    if (route.startsWith('/players/[id]')) route = route.replace('[id]', 'consistency-a');
    else if (route.startsWith('/sessions/[id]')) route = route.replace('[id]', 'consistency-a-current');
    else if (route.startsWith('/tests/[id]')) route = route.replace('[id]', testId);
    assert.ok(!route.includes('['), 'New dynamic route requires an explicit fixture');
    return route;
  });
  const blockedDemo = ['/import', '/recover', '/setup', '/settings/diagnostics', '/license'];
  const originalSize = win.getSize();
  let checked = 0;
  const failures = [];
  try {
    for (const [width, height] of [[1366, 768], [1600, 900], [1920, 1080]]) {
      win.setContentSize(width, height);
      for (const route of routes) {
        if (workspace === 'demo' && blockedDemo.includes(route)) continue;
        await win.loadURL(new URL(route, origin).href);
        await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
        const state = await win.webContents.executeJavaScript(`(() => ({
          width: innerWidth, documentWidth: document.documentElement.scrollWidth,
          title: document.querySelector('h1')?.textContent,
          error: /Application error|PrismaClient|Unhandled Runtime Error|Internal Server Error/.test(document.body.innerText),
          blank: document.body.innerText.trim().length < 10,
          controls: document.querySelectorAll('button,a,select,input').length,
          path: location.pathname
        }))()`);
        if (state.error || state.blank || state.documentWidth > state.width + 2) {
          failures.push({ route, width, blank: state.blank, error: state.error, overflow: state.documentWidth - state.width });
        }
        const captureDir=process.env.PASKO_AUDIT_SCREENSHOT_DIR;
        if(captureDir && width===1366 && ['/','/analytics','/compare','/players/consistency-a'].includes(route)) {
          const resolved=path.resolve(captureDir);
          if(!resolved.startsWith(path.resolve('C:/Temp/pasko-visual-audit')+path.sep))throw Error('Screenshot target outside audit root');
          fs.mkdirSync(resolved,{recursive:true});
          fs.writeFileSync(path.join(resolved,`${workspace}-${route==='/'?'dashboard':route.slice(1).replaceAll('/','-')}.png`),(await win.webContents.capturePage()).toPNG());
        }
        checked++;
      }
    }
  } finally { win.setSize(...originalSize); }
  console.log(`All-page rendered smoke ${workspace}: ${routes.length} tracked pages; ${checked} viewport/page checks; failures ${JSON.stringify(failures)}`);
  assert.deepEqual(failures, [], 'Rendered page errors/whole-document horizontal overflow');
};
