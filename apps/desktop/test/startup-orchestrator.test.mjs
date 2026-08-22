import assert from 'node:assert/strict';
import test from 'node:test';
import { startPackagedServices, stopPackagedServices } from '../dist/main/startup-orchestrator.js';

test('migration/database failure prevents web startup', async () => {
  let webStarts = 0;
  await assert.rejects(startPackagedServices({ startDatabase: async () => { throw new Error('migration failed'); }, startWeb: async () => { webStarts += 1; return { stop: () => true }; } }), /database startup failed/);
  assert.equal(webStarts, 0);
});

test('web startup failure stops the database', async () => {
  let databaseStops = 0;
  await assert.rejects(startPackagedServices({ startDatabase: async () => ({ databaseUrl: 'secret', stop: async () => { databaseStops += 1; return true; } }), startWeb: async () => { throw new Error('web failed'); } }), /web startup failed/);
  assert.equal(databaseStops, 1);
});

test('shutdown orders web before database and remains safe with absent services', async () => {
  const order = [];
  await stopPackagedServices({ web: { stop: () => { order.push('web'); return true; } }, database: { databaseUrl: 'secret', stop: async () => { order.push('database'); return true; } } });
  assert.deepEqual(order, ['web', 'database']); await stopPackagedServices({ web: null, database: null });
});
