import { v } from 'convex/values';
import { mutation, query } from '../_generated/server';
import { internal } from '../_generated/api';
import { residentSeeds } from '../../data/residents';
import { normalizePublicProductUrl, productIdentity } from './productInput';

const INITIAL_STATE = {
  awareness: 0,
  curiosity: 0.1,
  trust: 0.5,
  purchaseIntent: 0.05,
  sentiment: 0,
  stage: 'unaware' as const,
  productBeliefs: [],
  socialProof: 0,
  expectedFriction: 0.25,
};

export const create = mutation({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const url = normalizePublicProductUrl(args.url);
    const existing = await ctx.db
      .query('products')
      .filter((q) => q.eq(q.field('url'), url))
      .first();
    if (existing) {
      if (existing.analysisStatus === 'pending') {
        await ctx.scheduler.runAfter(0, internal.launchTown.productAnalyzer.analyzeProduct, {
          productId: existing._id,
          url,
        });
      }
      return existing._id;
    }

    const productId = await ctx.db.insert('products', {
      ...productIdentity(url),
      url,
      analysisStatus: 'pending',
    });
    const now = Date.now();
    for (const resident of residentSeeds) {
      await ctx.db.insert('residentProfiles', {
        productId,
        residentKey: resident.residentKey,
        name: resident.name,
        role: resident.role,
        ...resident.traits,
      });
      await ctx.db.insert('residentStates', {
        productId,
        residentKey: resident.residentKey,
        ...INITIAL_STATE,
        updatedAt: now,
      });
    }
    for (const edge of [
      ['priya', 'rohan', 0.9],
      ['rohan', 'priya', 0.9],
      ['rohan', 'meera', 0.7],
      ['meera', 'rohan', 0.7],
    ] as const) {
      await ctx.db.insert('socialEdges', {
        productId,
        sourceResidentKey: edge[0],
        targetResidentKey: edge[1],
        relationshipStrength: edge[2],
      });
    }
    await ctx.scheduler.runAfter(0, internal.launchTown.productAnalyzer.analyzeProduct, {
      productId,
      url,
    });
    return productId;
  },
});

export const getScenario = query({
  args: { productId: v.id('products') },
  handler: async (ctx, { productId }) => {
    const product = await ctx.db.get(productId);
    if (!product) return null;
    const [profiles, states, edges, browserRuns, influenceEvents] = await Promise.all([
      ctx.db
        .query('residentProfiles')
        .withIndex('product', (q) => q.eq('productId', productId))
        .collect(),
      ctx.db
        .query('residentStates')
        .withIndex('product', (q) => q.eq('productId', productId))
        .collect(),
      ctx.db
        .query('socialEdges')
        .withIndex('product', (q) => q.eq('productId', productId))
        .collect(),
      ctx.db
        .query('browserRuns')
        .withIndex('product', (q) => q.eq('productId', productId))
        .collect(),
      ctx.db
        .query('influenceEvents')
        .withIndex('product', (q) => q.eq('productId', productId))
        .collect(),
    ]);
    return { product, profiles, states, edges, browserRuns, influenceEvents, phase: null };
  },
});
