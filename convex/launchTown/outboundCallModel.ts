import { v } from 'convex/values';
import { internalMutation, internalQuery, query } from '../_generated/server';
import {
  bolnaExecutionStatus,
  outboundCallStatus,
  outboundFailureCode,
  safeCallFinding,
} from './validators';
import {
  OUTBOUND_CALL_ACTIVE_LEASE_MS,
  OUTBOUND_CALL_COOLDOWN_MS,
  OUTBOUND_CALL_WINDOW_MS,
  evaluateCallGate,
} from './outboundCallPolicy';

const LEDGERLY_SLUG = 'ledgerly';

const productArgs = { productId: v.optional(v.id('products')) };

export const reserve = internalMutation({
  args: {
    ...productArgs,
    residentKey: v.string(),
    destinationMask: v.string(),
  },
  handler: async (ctx, args) => {
    const product = args.productId
      ? await ctx.db.get(args.productId)
      : await ctx.db
          .query('products')
          .withIndex('slug', (q) => q.eq('slug', LEDGERLY_SLUG))
          .unique();
    if (!product) return { ok: false as const, code: 'CONTEXT_NOT_FOUND' as const };
    const profile = await ctx.db
      .query('residentProfiles')
      .withIndex('product_resident', (q) =>
        q.eq('productId', product._id).eq('residentKey', args.residentKey),
      )
      .unique();
    if (!profile) return { ok: false as const, code: 'CONTEXT_NOT_FOUND' as const };

    const now = Date.now();
    const activeCalls = await ctx.db
      .query('outboundVoiceCalls')
      .withIndex('active', (q) => q.eq('active', true))
      .collect();
    for (const stale of activeCalls.filter(
      (call) => now - call.requestedAt >= OUTBOUND_CALL_ACTIVE_LEASE_MS,
    )) {
      await ctx.db.patch(stale._id, {
        active: false,
        status: 'failed',
        failureCode: 'poll_timeout',
        completedAt: now,
        updatedAt: now,
      });
    }
    const liveActive = activeCalls
      .filter((call) => now - call.requestedAt < OUTBOUND_CALL_ACTIVE_LEASE_MS)
      .sort((a, b) => b.requestedAt - a.requestedAt)[0];
    const recent = await ctx.db
      .query('outboundVoiceCalls')
      .withIndex('requestedAt', (q) => q.gte('requestedAt', now - OUTBOUND_CALL_WINDOW_MS))
      .collect();
    const decision = evaluateCallGate({
      now,
      activeRequestedAt: liveActive?.requestedAt,
      recentRequestedAts: recent.map((call) => call.requestedAt),
    });
    if (!decision.ok) return decision;

    const callId = await ctx.db.insert('outboundVoiceCalls', {
      productId: product._id,
      residentKey: args.residentKey,
      status: 'initiated',
      active: true,
      destinationMask: args.destinationMask,
      provider: 'vobiz',
      requestedAt: now,
      updatedAt: now,
    });
    return { ok: true as const, callId };
  },
});

export const attachExecution = internalMutation({
  args: { callId: v.id('outboundVoiceCalls'), executionId: v.string() },
  handler: async (ctx, { callId, executionId }) => {
    const call = await ctx.db.get(callId);
    if (!call || !call.active || call.executionId) return false;
    await ctx.db.patch(callId, {
      executionId,
      providerStatus: 'queued',
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const failRequest = internalMutation({
  args: { callId: v.id('outboundVoiceCalls'), failureCode: outboundFailureCode },
  handler: async (ctx, { callId, failureCode }) => {
    const call = await ctx.db.get(callId);
    if (!call || !call.active) return;
    const now = Date.now();
    await ctx.db.patch(callId, {
      status: 'failed',
      active: false,
      failureCode,
      completedAt: now,
      updatedAt: now,
    });
  },
});

export const getPollTarget = internalQuery({
  args: { callId: v.id('outboundVoiceCalls') },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (!call?.active || !call.executionId) return null;
    return {
      executionId: call.executionId,
      requestedAt: call.requestedAt,
    };
  },
});

export const applyExecution = internalMutation({
  args: {
    callId: v.id('outboundVoiceCalls'),
    status: outboundCallStatus,
    providerStatus: bolnaExecutionStatus,
    provider: v.union(v.literal('vobiz'), v.literal('unknown')),
    durationSeconds: v.optional(v.number()),
    findings: v.array(safeCallFinding),
    failureCode: v.optional(outboundFailureCode),
  },
  handler: async (ctx, args) => {
    const call = await ctx.db.get(args.callId);
    if (!call?.active) return { terminal: true };
    const terminal = args.status === 'completed' || args.status === 'failed';
    const now = Date.now();
    await ctx.db.patch(args.callId, {
      status: args.status,
      providerStatus: args.providerStatus,
      provider: args.provider,
      active: !terminal,
      durationSeconds: args.durationSeconds,
      findings: terminal ? args.findings : undefined,
      failureCode: args.failureCode,
      startedAt:
        call.startedAt ??
        (args.status === 'ringing' || args.status === 'in-progress' || terminal ? now : undefined),
      completedAt: terminal ? now : undefined,
      updatedAt: now,
    });
    return { terminal };
  },
});

export const latestForResident = query({
  args: { ...productArgs, residentKey: v.string() },
  handler: async (ctx, args) => {
    const product = args.productId
      ? await ctx.db.get(args.productId)
      : await ctx.db
          .query('products')
          .withIndex('slug', (q) => q.eq('slug', LEDGERLY_SLUG))
          .unique();
    if (!product) return null;
    const call = await ctx.db
      .query('outboundVoiceCalls')
      .withIndex('product_resident_requestedAt', (q) =>
        q.eq('productId', product._id).eq('residentKey', args.residentKey),
      )
      .order('desc')
      .first();
    if (!call) return null;
    return {
      status: call.status,
      providerStatus: call.providerStatus,
      provider: call.provider,
      destinationMask: call.destinationMask,
      requestedAt: call.requestedAt,
      startedAt: call.startedAt,
      completedAt: call.completedAt,
      updatedAt: call.updatedAt,
      durationSeconds: call.durationSeconds,
      findings: call.findings ?? [],
      failureCode: call.failureCode,
      nextAllowedAt: call.requestedAt + OUTBOUND_CALL_COOLDOWN_MS,
    };
  },
});
