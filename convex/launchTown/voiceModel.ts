import { v } from 'convex/values';
import { internalQuery } from '../_generated/server';
import { serializeResidentVoiceContext } from './voiceContext';

const LEDGERLY_SLUG = 'ledgerly';

export const loadResidentVoiceUserData = internalQuery({
  args: { residentKey: v.string() },
  handler: async (ctx, { residentKey }) => {
    const product = await ctx.db
      .query('products')
      .withIndex('slug', (q) => q.eq('slug', LEDGERLY_SLUG))
      .unique();
    if (!product) return null;

    const [profile, state, browserRuns] = await Promise.all([
      ctx.db
        .query('residentProfiles')
        .withIndex('product_resident', (q) =>
          q.eq('productId', product._id).eq('residentKey', residentKey),
        )
        .unique(),
      ctx.db
        .query('residentStates')
        .withIndex('product_resident', (q) =>
          q.eq('productId', product._id).eq('residentKey', residentKey),
        )
        .unique(),
      ctx.db
        .query('browserRuns')
        .withIndex('product_resident', (q) =>
          q.eq('productId', product._id).eq('residentKey', residentKey),
        )
        .collect(),
    ]);
    if (!profile || !state) return null;

    const playerDescription = await ctx.db
      .query('playerDescriptions')
      .filter((q) => q.eq(q.field('name'), profile.name))
      .first();
    const memories = playerDescription
      ? await ctx.db
          .query('memories')
          .withIndex('playerId', (q) => q.eq('playerId', playerDescription.playerId))
          .collect()
      : [];

    const memoryExperiences = memories
      .filter(
        (memory) =>
          memory.data.type === 'productExperience' && memory.data.productId === product._id,
      )
      .map((memory) => ({
        outcome: memory.description,
        pagesVisited:
          memory.data.type === 'productExperience' ? memory.data.pagesVisited : undefined,
      }));
    const runExperiences = browserRuns
      .filter((run) => run.status === 'completed' && run.result)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((run) => ({
        outcome: run.result!.outcome,
        pagesVisited: run.result!.pagesVisited,
      }));
    const memoryHearsay = memories
      .filter(
        (memory) => memory.data.type === 'productHearsay' && memory.data.productId === product._id,
      )
      .map((memory) =>
        memory.data.type === 'productHearsay'
          ? {
              claim: memory.data.claim,
              source: memory.data.sourceResidentKey,
              confidence: memory.data.confidence,
            }
          : null,
      )
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const beliefHearsay = state.productBeliefs
      .filter((belief) => belief.origin === 'hearsay')
      .map((belief) => ({
        claim: belief.claim,
        source: belief.source,
        confidence: belief.confidence,
      }));

    return serializeResidentVoiceContext({
      product: { name: product.name, url: product.url },
      profile,
      state,
      experiences: [...runExperiences, ...memoryExperiences],
      hearsay: [...beliefHearsay, ...memoryHearsay],
    });
  },
});
