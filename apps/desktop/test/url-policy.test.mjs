import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyNavigation, getInternalUrl } from '../dist/main/url-policy.js';
const internal = getInternalUrl('http://127.0.0.1:3000');
test('allows only exact internal origin', () => {
  assert.equal(classifyNavigation('http://127.0.0.1:3000/players', internal), 'internal');
  assert.equal(classifyNavigation('http://127.0.0.1:3001/', internal), 'blocked');
  assert.equal(classifyNavigation('http://127.0.0.1:3000.evil.example/', internal), 'blocked');
});
test('allows safe HTTPS as external', () => assert.equal(classifyNavigation('https://example.com/', internal), 'external'));
test('blocks unsafe, invalid, and credentialed URLs', () => {
  for (const target of ['file:///C:/x', 'javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'custom://x', 'https://u:p@example.com/', 'not a url'])
    assert.equal(classifyNavigation(target, internal), 'blocked', target);
});
