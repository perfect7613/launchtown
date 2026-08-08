import { v } from 'convex/values';
import { internalMutation, internalQuery } from '../_generated/server';
import { browserResult, browserRunSource, browserSessionStatus } from './validators';
import { uniquePersonaKeys } from './browserRunPolicy';

export const loadBrowserContext = internalQuery({
  args: { productId: v.id('products'), residentKey: v.string() },
  handler: async (ctx, args) => {
    const [product, profile, state, edges] = await Promise.all([
      ctx.db.get(args.productId),
      ctx.db
        .query('residentProfiles')
        .withIndex('product_resident', (q) =>
          q.eq('productId', args.productId).eq('residentKey', args.residentKey),
        )
        .unique(),
      ctx.db
        .query('residentStates')
        .withIndex('product_resident', (q) =>
          q.eq('productId', args.productId).eq('residentKey', args.residentKey),
        )
        .unique(),
      ctx.db
        .query('socialEdges')
        .withIndex('product', (q) => q.eq('productId', args.productId))
        .collect(),
    ]);
    if (!product || !profile || !state) return null;
    return { product, profile, state, edges };
  },
});

export const createBrowserRun = internalMutation({
  args: {
    productId: v.id('products'),
    residentKey: v.string(),
    objective: v.string(),
    simulationRunId: v.optional(v.string()),
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
    sessionId: v.optional(v.string()),
    sessionStatus: v.optional(browserSessionStatus),
    source: v.optional(browserRunSource),
  },
  handler: async (ctx, { browserRunId, ...patch }) => {
    await ctx.db.patch(browserRunId, { ...patch, updatedAt: Date.now() });
  },
});

export const markBrowserRunFailed = internalMutation({
  args: {
    browserRunId: v.id('browserRuns'),
    source: browserRunSource,
    sessionId: v.optional(v.string()),
    sessionStatus: v.optional(browserSessionStatus),
    fallbackNotice: v.optional(v.string()),
  },
  handler: async (ctx, { browserRunId, ...patch }) => {
    await ctx.db.patch(browserRunId, {
      ...patch,
      status: 'failed',
      updatedAt: Date.now(),
    });
  },
});

export const applyBrowserResult = internalMutation({
  args: {
    browserRunId: v.id('browserRuns'),
    output: browserResult,
    fallbackNotice: v.optional(v.string()),
    source: browserRunSource,
    sessionId: v.optional(v.string()),
    sessionStatus: v.optional(browserSessionStatus),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const browserRun = await ctx.db.get(args.browserRunId);
    if (!browserRun) throw new Error('Browser run not found');
    const state = await ctx.db
      .query('residentStates')
      .withIndex('product_resident', (q) =>
        q.eq('productId', browserRun.productId).eq('residentKey', browserRun.residentKey),
      )
      .unique();
    if (!state) throw new Error('Resident state not found for browser result');
    const trust = Math.min(1, Math.max(0, state.trust + args.output.trustDelta));
    const purchaseIntent = Math.min(1, Math.max(0, state.purchaseIntent + args.output.intentDelta));
    await ctx.db.patch(state._id, {
      trust,
      purchaseIntent,
      sentiment: Math.min(1, Math.max(-1, state.sentiment + args.output.trustDelta * 0.5)),
      expectedFriction: Math.min(1, args.output.frictions.length * 0.2),
      stage: args.output.converted ? 'converted' : 'evaluating',
      productBeliefs: [
        ...state.productBeliefs,
        ...args.output.positiveSignals.map((claim) => ({
          claim,
          confidence: 0.9,
          source: browserRun.residentKey,
          origin: 'observed' as const,
        })),
      ],
      updatedAt: Date.now(),
    });
    await ctx.db.patch(browserRun._id, {
      status: 'completed',
      result: args.output,
      fallbackNotice: args.fallbackNotice,
      source: args.source,
      sessionId: args.sessionId,
      sessionStatus: args.sessionStatus,
      updatedAt: Date.now(),
    });

    const profile = await ctx.db
      .query('residentProfiles')
      .withIndex('product_resident', (q) =>
        q.eq('productId', browserRun.productId).eq('residentKey', browserRun.residentKey),
      )
      .unique();
    const playerDescription = profile
      ? await ctx.db
          .query('playerDescriptions')
          .filter((q) => q.eq(q.field('name'), profile.name))
          .first()
      : null;
    if (playerDescription) {
      const embeddingId = await ctx.db.insert('memoryEmbeddings', {
        playerId: playerDescription.playerId,
        embedding: args.embedding,
      });
      await ctx.db.insert('memories', {
        playerId: playerDescription.playerId,
        embeddingId,
        description: args.output.outcome,
        importance: 8,
        lastAccess: Date.now(),
        data: {
          type: 'productExperience',
          productId: browserRun.productId,
          browserRunId: browserRun._id,
          outcome: args.output.outcome,
          pagesVisited: args.output.pagesVisited,
          observedAt: Date.now(),
        },
      });
    }
    return { trust, purchaseIntent };
  },
});

export const listPersonaKeys = internalQuery({
  args: { productId: v.id('products') },
  handler: async (ctx, { productId }) => {
    const profiles = await ctx.db
      .query('residentProfiles')
      .withIndex('product', (q) => q.eq('productId', productId))
      .collect();
    return uniquePersonaKeys(profiles.map((profile) => profile.residentKey));
  },
});
