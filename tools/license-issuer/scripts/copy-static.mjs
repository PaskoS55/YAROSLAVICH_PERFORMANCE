import { cp, mkdir } from 'node:fs/promises';
await mkdir(new URL('../dist/renderer/', import.meta.url), { recursive: true });
await cp(new URL('../src/renderer/', import.meta.url), new URL('../dist/renderer/', import.meta.url), { recursive: true });
