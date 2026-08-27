import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { decideWindowNavigation, installWindowNavigation } from '../dist/main/window-navigation.js';

const club = new URL('http://127.0.0.1:3101');
const demo = new URL('http://127.0.0.1:3102');
test('workspace navigation permits only the two exact trusted origins', () => {
  for (const base of [club, demo]) assert.equal(decideWindowNavigation(new URL('/players', base).href, club, demo).action, 'allow');
  for (const url of ['http://localhost:3101/', 'http://127.0.0.1:3103/', 'http://user:pass@127.0.0.1:3101/', 'file:///C:/test', 'javascript:1', 'data:text/html,test', 'invalid']) assert.equal(decideWindowNavigation(url, club, demo).action, 'block', url);
  assert.equal(decideWindowNavigation('https://example.com/', club, demo).action, 'external');
});
test('workspace entry, return and demo login resolve to main-owned destinations', () => {
  assert.deepEqual(decideWindowNavigation(new URL('/demo-workspace', club).href, club, demo), { action: 'switch', url: demo.href });
  assert.deepEqual(decideWindowNavigation(new URL('/club-workspace', demo).href, club, demo), { action: 'switch', url: club.href });
  assert.deepEqual(decideWindowNavigation(new URL('/login', demo).href, club, demo), { action: 'switch', url: new URL('/login', club).href });
});
test('navigation and HTTP redirects share policy, popups are denied, login clears Back history', async () => {
  const contents = new EventEmitter(); const loaded = []; const external = []; let cleared = 0;
  contents.setWindowOpenHandler = (handler) => { contents.popup = handler; };
  contents.loadURL = async (url) => { loaded.push(url); };
  contents.isDestroyed = () => false;
  contents.getURL = () => new URL('/login', club).href;
  contents.navigationHistory = { clear: () => { cleared++; } };
  installWindowNavigation(contents, club, demo, (url) => external.push(url));
  for (const name of ['will-navigate', 'will-redirect']) {
    let blocked = false;
    contents.emit(name, { url: new URL('/demo-workspace', club).href, preventDefault: () => { blocked = true; } });
    await nextTurn(); assert.equal(blocked, true); assert.equal(loaded.at(-1), demo.href);
    blocked = false;
    contents.emit(name, { url: new URL('/api/auth/logout', club).href, preventDefault: () => { blocked = true; } });
    assert.equal(blocked, false);
    contents.emit(name, { url: 'http://localhost:3101/login', preventDefault: () => { blocked = true; } });
    assert.equal(blocked, true);
  }
  for (const url of [club.href, demo.href, 'invalid', 'https://example.com/']) assert.deepEqual(contents.popup({ url }), { action: 'deny' });
  assert.deepEqual(external, ['https://example.com/']);
  contents.emit('did-finish-load'); assert.equal(cleared, 1);
});
