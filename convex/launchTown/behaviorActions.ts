import { v } from 'convex/values';
import { internalAction } from '../_generated/server';
import { api, internal } from '../_generated/api';
import { decideNextAction } from './behavior';

export const decideAfterInfluence = internalAction({
  args: { productId: v.id('products'), residentKey: v.string() },
  handler: async (ctx, args): Promise<'browse' | 'talk' | 'idle'> => {
    const context = await ctx.runQuery(
      internal.launchTown.browserRunModel.loadBrowserContext,
      args,
    );
    if (!context) return 'idle';
    const next = decideNextAction(context.profile, context.state, {
      socialProof: context.state.socialProof,
      expectedFriction: context.state.expectedFriction,
      hasAvailablePeer: true,
    });
    if (next.kind === 'browse') {
      await ctx.runAction(api.launchTown.browserRunner.runForResident, {
        ...args,
        objective: `Evaluate ${context.product.name} after a trusted conversation`,
      });
    }
    return next.kind;
  },
});
