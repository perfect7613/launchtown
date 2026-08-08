import { v } from 'convex/values';
import { internalMutation, internalQuery } from '../_generated/server';

export const finishBrowserPhase = internalMutation({
  args: {
    runId: v.string(),
    hasErrors: v.boolean(),
  },
  handler: async (ctx, { runId, hasErrors }) => {
    const run = await ctx.db
      .query('simulationRuns')
      .withIndex('run', (q) => q.eq('runId', runId))
      .unique();
    if (!run) return;
    const now = Date.now();
    if (hasErrors) {
      await ctx.db.patch(run._id, {
        browserPhaseComplete: true,
        status: 'failed',
        completedAt: now,
        failureReason: 'One or more persona browser journeys failed',
      });
      return;
    }
    await ctx.db.patch(run._id, {
      browserPhaseComplete: true,
      ...(run.status === 'simulation_complete'
        ? { status: 'completed' as const, completedAt: now }
        : {}),
    });
  },
});

export const latestCompleted = internalQuery({
  args: { productId: v.id('products') },
  handler: async (ctx, { productId }) => {
    const runs = await ctx.db
      .query('simulationRuns')
      .withIndex('product', (q) => q.eq('productId', productId))
      .order('desc')
      .collect();
    return runs.find((run) => run.status === 'completed') ?? null;
  },
});
