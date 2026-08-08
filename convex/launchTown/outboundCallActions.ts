'use node';

import { v } from 'convex/values';
import { internalAction } from '../_generated/server';
import { internal } from '../_generated/api';
import { getBolnaExecution } from './bolnaOutboundClient';
import {
  OUTBOUND_CALL_ACTIVE_LEASE_MS,
  OUTBOUND_CALL_POLL_INTERVAL_MS,
  parseBolnaExecutionSnapshot,
} from './outboundCallPolicy';

export const pollExecution = internalAction({
  args: { callId: v.id('outboundVoiceCalls') },
  handler: async (ctx, { callId }): Promise<void> => {
    const target = await ctx.runQuery(internal.launchTown.outboundCallModel.getPollTarget, {
      callId,
    });
    if (!target) return;
    const apiKey = process.env.BOLNA_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.launchTown.outboundCallModel.failRequest, {
        callId,
        failureCode: 'provider_unavailable',
      });
      return;
    }

    let rawExecution: unknown;
    try {
      rawExecution = await getBolnaExecution({ apiKey, executionId: target.executionId });
    } catch {
      if (Date.now() - target.requestedAt >= OUTBOUND_CALL_ACTIVE_LEASE_MS) {
        await ctx.runMutation(internal.launchTown.outboundCallModel.failRequest, {
          callId,
          failureCode: 'poll_timeout',
        });
        return;
      }
      await ctx.scheduler.runAfter(
        OUTBOUND_CALL_POLL_INTERVAL_MS,
        internal.launchTown.outboundCallActions.pollExecution,
        { callId },
      );
      return;
    }

    const snapshot = parseBolnaExecutionSnapshot(rawExecution);
    if (!snapshot) {
      if (Date.now() - target.requestedAt >= OUTBOUND_CALL_ACTIVE_LEASE_MS) {
        await ctx.runMutation(internal.launchTown.outboundCallModel.failRequest, {
          callId,
          failureCode: 'poll_timeout',
        });
        return;
      }
      await ctx.scheduler.runAfter(
        OUTBOUND_CALL_POLL_INTERVAL_MS,
        internal.launchTown.outboundCallActions.pollExecution,
        { callId },
      );
      return;
    }

    const result = await ctx.runMutation(internal.launchTown.outboundCallModel.applyExecution, {
      callId,
      ...snapshot,
    });
    if (!result.terminal) {
      await ctx.scheduler.runAfter(
        OUTBOUND_CALL_POLL_INTERVAL_MS,
        internal.launchTown.outboundCallActions.pollExecution,
        { callId },
      );
    }
  },
});
