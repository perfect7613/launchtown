import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';

export const createBrowserRun = internalMutation({
  args: {
    productId: v.id('products'),
    residentKey: v.string(),
    objective: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert('browserRuns', {
      ...args,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateBrowserRun = internalMutation({
  args: {
    browserRunId: v.id('browserRuns'),
    status: v.union(
      v.literal('queued'),
      v.literal('stubbed'),
      v.literal('running'),
      v.literal('ready'),
      v.literal('completed'),
      v.literal('failed'),
    ),
    runId: v.optional(v.string()),
    liveViewUrl: v.optional(v.string()),
  },
  handler: async (ctx, { browserRunId, ...patch }) => {
    await ctx.db.patch(browserRunId, { ...patch, updatedAt: Date.now() });
  },
});

