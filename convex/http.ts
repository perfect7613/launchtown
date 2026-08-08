import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

const http = httpRouter();

const SESSION_PATH = '/bolna/session';

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const allowed = (process.env.BOLNA_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowed.includes(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  });
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function json(status: number, body: unknown, origin: string | null): Response {
  const headers = corsHeaders(origin);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { status, headers });
}

http.route({
  path: SESSION_PATH,
  method: 'OPTIONS',
  handler: httpAction(async (_, request) => {
    const origin = allowedOrigin(request);
    return origin
      ? new Response(null, { status: 204, headers: corsHeaders(origin) })
      : json(403, { message: 'Origin is not allowed.' }, null);
  }),
});

http.route({
  path: SESSION_PATH,
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const origin = allowedOrigin(request);
    if (!origin) return json(403, { message: 'Origin is not allowed.' }, null);

    const body = (await request.json().catch(() => null)) as {
      user_data?: { residentKey?: unknown };
    } | null;
    const residentKey = body?.user_data?.residentKey;
    if (typeof residentKey !== 'string' || !/^[a-z]{2,24}$/.test(residentKey)) {
      return json(400, { message: 'A valid residentKey is required.' }, origin);
    }

    const apiKey = process.env.BOLNA_API_KEY;
    const agentId = process.env.BOLNA_AGENT_ID;
    if (!apiKey || !agentId) {
      return json(503, { message: 'Resident interviews are not configured.' }, origin);
    }

    const userData = await ctx.runQuery(internal.launchTown.voiceModel.loadResidentVoiceUserData, {
      residentKey,
    });
    if (!userData) return json(404, { message: 'Resident voice context was not found.' }, origin);

    const response = await fetch('https://api.bolna.ai/web-call/freeswitch-session', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agent_id: agentId, user_data: userData }),
    });
    if (!response.ok) {
      return json(response.status, { message: 'Bolna could not start this interview.' }, origin);
    }

    const headers = corsHeaders(origin);
    headers.set('Content-Type', 'application/json');
    return new Response(await response.text(), { status: response.status, headers });
  }),
});

export default http;
