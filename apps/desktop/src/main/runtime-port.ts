import { createServer } from 'node:net';
export async function findAvailableLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref(); server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
      const address = server.address();
      if (!address || typeof address === 'string') { server.close(); reject(new Error('Unable to determine a loopback port')); return; }
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}
