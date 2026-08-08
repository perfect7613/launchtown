import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { BolnaOutboundError, startBolnaOutboundCall } from './launchTown/bolnaOutboundClient';
import {
  isAllowedVoiceOrigin,
  isValidE164,
  maskE164,
  parseOutboundCallRequest,
} from './launchTown/outboundCallPolicy';

const http = httpRouter();

const SESSION_PATH = '/bolna/session';
const OUTBOUND_PATH = '/bolna/outbound';

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get('Origin');
  return isAllowedVoiceOrigin(origin, process.env.BOLNA_ALLOWED_ORIGINS ?? '') ? origin : null;
}

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
      user_data?: { residentKey?: unknown; productId?: unknown };
    } | null;
    const residentKey = body?.user_data?.residentKey;
    const rawProductId = body?.user_data?.productId;
    if (typeof residentKey !== 'string' || !/^[a-z]{2,24}$/.test(residentKey)) {
      return json(400, { message: 'A valid residentKey is required.' }, origin);
    }
    if (rawProductId !== undefined && typeof rawProductId !== 'string') {
      return json(400, { message: 'A valid productId is required.' }, origin);
    }
    const productId = rawProductId as Id<'products'> | undefined;

    const apiKey = process.env.BOLNA_API_KEY;
    const agentId = process.env.BOLNA_AGENT_ID;
    if (!apiKey || !agentId) {
      return json(503, { message: 'Resident interviews are not configured.' }, origin);
    }

    const userData = await ctx
      .runQuery(internal.launchTown.voiceModel.loadResidentVoiceUserData, {
        residentKey,
        productId,
      })
      .catch(() => null);
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

http.route({
  path: OUTBOUND_PATH,
  method: 'OPTIONS',
  handler: httpAction(async (_, request) => {
    const origin = allowedOrigin(request);
    return origin
      ? new Response(null, { status: 204, headers: corsHeaders(origin) })
      : json(403, { code: 'ORIGIN_NOT_ALLOWED' }, null);
  }),
});

http.route({
  path: OUTBOUND_PATH,
  method: 'GET',
  handler: httpAction(async (_, request) => {
    const origin = allowedOrigin(request);
    if (!origin) return json(403, { code: 'ORIGIN_NOT_ALLOWED' }, null);
    const recipient = process.env.BOLNA_OUTBOUND_RECIPIENT_PHONE;
    const configured =
      !!process.env.BOLNA_API_KEY && !!process.env.BOLNA_AGENT_ID && isValidE164(recipient);
    return json(
      200,
      configured ? { available: true, destinationMask: maskE164(recipient) } : { available: false },
      origin,
    );
  }),
});

http.route({
  path: OUTBOUND_PATH,
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const origin = allowedOrigin(request);
    if (!origin) return json(403, { code: 'ORIGIN_NOT_ALLOWED' }, null);
    const contentLength = Number(request.headers.get('Content-Length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > 2_048) {
      return json(413, { code: 'REQUEST_TOO_LARGE' }, origin);
    }
    const parsed = parseOutboundCallRequest(await request.json().catch(() => null));
    if (!parsed.ok) return json(400, { code: parsed.code }, origin);
    const residentKey = parsed.residentKey;
    const productId = parsed.productId as Id<'products'> | undefined;
    const apiKey = process.env.BOLNA_API_KEY;
    const agentId = process.env.BOLNA_AGENT_ID;
    const recipientPhone = process.env.BOLNA_OUTBOUND_RECIPIENT_PHONE;
    if (!apiKey || !agentId || !isValidE164(recipientPhone)) {
      return json(503, { code: 'OUTBOUND_NOT_CONFIGURED' }, origin);
    }

    const userData = await ctx
      .runQuery(internal.launchTown.voiceModel.loadResidentVoiceUserData, {
        residentKey,
        productId,
      })
      .catch(() => null);
    if (!userData) return json(404, { code: 'CONTEXT_NOT_FOUND' }, origin);

    const reservation = await ctx
      .runMutation(internal.launchTown.outboundCallModel.reserve, {
        residentKey,
        productId,
        destinationMask: maskE164(recipientPhone),
      })
      .catch(() => null);
    if (!reservation) return json(400, { code: 'INVALID_REQUEST' }, origin);
    if (!reservation.ok) {
      if (reservation.code === 'CONTEXT_NOT_FOUND') {
        return json(404, { code: reservation.code }, origin);
      }
      return json(
        reservation.code === 'CALL_ACTIVE' ? 409 : 429,
        {
          code: reservation.code,
          retryAfterSeconds: Math.max(1, Math.ceil(reservation.retryAfterMs / 1_000)),
        },
        origin,
      );
    }

    try {
      const { executionId } = await startBolnaOutboundCall({
        apiKey,
        agentId,
        recipientPhone,
        userData,
      });
      const attached = await ctx.runMutation(
        internal.launchTown.outboundCallModel.attachExecution,
        { callId: reservation.callId, executionId },
      );
      if (!attached) throw new BolnaOutboundError('invalid_response');
      await ctx.scheduler.runAfter(2_000, internal.launchTown.outboundCallActions.pollExecution, {
        callId: reservation.callId,
      });
      return json(202, { status: 'initiated' }, origin);
    } catch (error) {
      const code =
        error instanceof BolnaOutboundError && error.code === 'provider_rejected'
          ? 'provider_rejected'
          : 'provider_unavailable';
      await ctx.runMutation(internal.launchTown.outboundCallModel.failRequest, {
        callId: reservation.callId,
        failureCode: code,
      });
      return json(
        error instanceof BolnaOutboundError && error.status === 429 ? 429 : 502,
        { code },
        origin,
      );
    }
  }),
});

export default http;
