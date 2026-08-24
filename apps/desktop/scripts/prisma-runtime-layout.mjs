import path from 'node:path';

export const PRISMA_VERSION = '5.22.0';
export function prismaRuntimePaths(root) {
  return {
    root,
    cli: path.join(root, 'node_modules/prisma/build/index.js'),
    schemaEngine: path.join(root, 'node_modules/@prisma/engines/schema-engine-windows.exe'),
    queryEngine: path.join(root, 'node_modules/.prisma/client/query_engine-windows.dll.node'),
    client: path.join(root, 'node_modules/.prisma/client/index.js'),
    schema: path.join(root, 'prisma/schema.prisma'),
    migrations: path.join(root, 'prisma/migrations'),
    bootstrap: path.join(root, 'bootstrap-reference.cjs'),
    demoBootstrap: path.join(root, 'bootstrap-demo.cjs'),
  };
}
