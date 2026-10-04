/**
 * Cloudflare Worker + Container wrapper for SocialCrabs / DM Boost.
 *
 * - The web UI (../public) is served as static assets by the Worker, so loading
 *   the page never wakes the container.
 * - Every other request must carry the API key; only then is it proxied to the
 *   single container instance (HTTP on 3847, WebSocket on 3848).
 * - Container disk is ephemeral, so sessions + rate limit history are mirrored
 *   into Durable Object storage and restored when the container starts.
 */
import { Container, getContainer, switchPort } from '@cloudflare/containers';

interface Env {
  DM_BOOST: DurableObjectNamespace<DmBoostContainer>;
  ASSETS: Fetcher;
  API_KEY: string;
}

const HTTP_PORT = 3847;
const WS_PORT = 3848;
const STATE_KEY = 'state';

export class DmBoostContainer extends Container<Env> {
  defaultPort = HTTP_PORT;
  requiredPorts = [HTTP_PORT, WS_PORT];
  sleepAfter = '30m';

  constructor(ctx: DurableObjectState<{}>, env: Env) {
    super(ctx, env);
    // Forward every string var/secret (API_KEY, platform credentials, RATE_LIMIT_*, NOTIFY_* ...)
    const vars: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === 'string') vars[key] = value;
    }
    this.envVars = { ...vars, HOST: '0.0.0.0', BROWSER_HEADLESS: 'true' };
  }

  override async onStart(): Promise<void> {
    const state = await this.ctx.storage.get<string>(STATE_KEY);
    if (!state) return;
    const res = await this.containerFetch('http://container/api/state', {
      method: 'PUT',
      headers: { 'x-api-key': this.env.API_KEY, 'content-type': 'application/json' },
      body: state,
    });
    console.log('Restored state into container', res.status);
  }

  override async onActivityExpired(): Promise<void> {
    await this.saveState();
    await this.stop();
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      return super.fetch(switchPort(request, WS_PORT));
    }

    const res = await this.containerFetch(request);
    // Logins, cookie imports and actions change sessions / rate limits
    if (request.method !== 'GET' && new URL(request.url).pathname.startsWith('/api/')) {
      this.ctx.waitUntil(this.saveState());
    }
    return res;
  }

  private async saveState(): Promise<void> {
    try {
      const res = await this.containerFetch('http://container/api/state', {
        headers: { 'x-api-key': this.env.API_KEY },
      });
      if (res.ok) {
        await this.ctx.storage.put(STATE_KEY, await res.text());
      } else {
        console.error('Failed to export state', res.status);
      }
    } catch (error) {
      console.error('Failed to save state', String(error));
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.API_KEY) {
      return Response.json({ error: 'API_KEY secret is not configured' }, { status: 500 });
    }

    const url = new URL(request.url);
    const providedKey = request.headers.get('x-api-key') || url.searchParams.get('apiKey');
    if (providedKey !== env.API_KEY) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return getContainer(env.DM_BOOST).fetch(request);
  },
} satisfies ExportedHandler<Env>;
