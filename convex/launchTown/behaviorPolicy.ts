import { v } from 'convex/values';
import { internalQuery } from '../_generated/server';
import { playerId } from '../aiTown/ids';

export const loadBehaviorContext = internalQuery({
  args: { worldId: v.id('worlds'), playerId },
  handler: async (ctx, args) => {
    const description = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', args.playerId))
      .unique();
    if (!description) return null;
    const product = await ctx.db
      .query('products')
      .withIndex('slug', (q) => q.eq('slug', 'ledgerly'))
      .unique();
    if (!product) return null;
    const residentKey = description.name.toLowerCase();
    const profile = await ctx.db
      .query('residentProfiles')
      .withIndex('product_resident', (q) =>
        q.eq('productId', product._id).eq('residentKey', residentKey),
      )
      .unique();
    const state = await ctx.db
      .query('residentStates')
      .withIndex('product_resident', (q) =>
        q.eq('productId', product._id).eq('residentKey', residentKey),
      )
      .unique();
    if (!profile || !state) return null;
    const latestBrowserRun = await ctx.db
      .query('browserRuns')
      .withIndex('product_resident', (q) =>
        q.eq('productId', product._id).eq('residentKey', residentKey),
      )
      .order('desc')
      .first();
    return { product, profile, state, latestBrowserRun };
  },
});
