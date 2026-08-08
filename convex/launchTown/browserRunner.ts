import { v } from 'convex/values';
import { action } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';

/**
 * Browser Use integration boundary. The Browser Use worker plugs its V4 create/poll
 * client into this action and reports lifecycle updates through browserRunModel.
 * This stub intentionally performs no external browsing and never logs liveViewUrl.
 */
export const runForResident = action({
  args: {
    productId: v.id('products'),
    residentKey: v.string(),
    objective: v.string(),
  },
  handler: async (ctx, args): Promise<{ browserRunId: Id<'browserRuns'>; status: 'stubbed' }> => {
    const browserRunId: Id<'browserRuns'> = await ctx.runMutation(
      internal.launchTown.browserRunModel.createBrowserRun,
      args,
    );
    await ctx.runMutation(internal.launchTown.browserRunModel.updateBrowserRun, {
      browserRunId,
      status: 'stubbed',
    });
    return { browserRunId, status: 'stubbed' };
  },
});

