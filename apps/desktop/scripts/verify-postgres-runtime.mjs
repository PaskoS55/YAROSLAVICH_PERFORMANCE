import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPostgresManifest, verifyPostgresRuntime } from './postgres-runtime-layout.mjs';
const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = await readPostgresManifest(path.join(desktopRoot, 'postgres-runtime.json'));
const root = path.join(desktopRoot, '.runtime', 'postgres');
const result = await verifyPostgresRuntime(root);
console.log(`Verified PostgreSQL ${manifest.version} runtime: ${root}`);
console.log(`Runtime files: ${result.files}; bytes: ${result.bytes}`);
