import { createHmac } from 'node:crypto';

export interface DatabaseCredentials { bootstrapPassword: string; applicationPassword: string }
export interface DatabaseCredentialsProvider { getCredentials(): Promise<DatabaseCredentials> }

export class PhaseFiveCredentialsProvider implements DatabaseCredentialsProvider {
  constructor(private readonly source: NodeJS.ProcessEnv) {}
  async getCredentials(): Promise<DatabaseCredentials> {
    const secret = this.source.AUTH_SESSION_SECRET;
    if (!secret) throw new Error('Packaged database credential source is unavailable');
    const derive = (domain: string) => createHmac('sha256', secret).update(`PASKO_DATABASE:${domain}`).digest('base64url');
    return { bootstrapPassword: derive('BOOTSTRAP'), applicationPassword: derive('APPLICATION') };
  }
}
