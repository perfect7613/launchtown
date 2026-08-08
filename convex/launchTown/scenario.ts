import { v } from 'convex/values';
import { mutation, query } from '../_generated/server';
import { internal } from '../_generated/api';
import { residentSeeds } from '../../data/residents';

const LEDGERLY_SLUG = 'ledgerly';
const LEDGERLY_URL = 'https://ledgerly-demo-six.vercel.app';
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

export const getLedgerly = query({
  args: {},
  handler: async (ctx) => {
    const product = await ctx.db
      .query('products')
      .withIndex('slug', (q) => q.eq('slug', LEDGERLY_SLUG))
      .unique();
    if (!product) return null;
    const [profiles, states, edges, phase, browserRuns, influenceEvents] = await Promise.all([
      ctx.db
        .query('residentProfiles')
        .withIndex('product', (q) => q.eq('productId', product._id))
        .collect(),
      ctx.db
        .query('residentStates')
        .withIndex('product', (q) => q.eq('productId', product._id))
        .collect(),
      ctx.db
        .query('socialEdges')
        .withIndex('product', (q) => q.eq('productId', product._id))
        .collect(),
      ctx.db
        .query('scenarioPhases')
        .withIndex('slug', (q) => q.eq('slug', LEDGERLY_SLUG))
        .unique(),
      ctx.db
        .query('browserRuns')
        .withIndex('product', (q) => q.eq('productId', product._id))
        .collect(),
      ctx.db
        .query('influenceEvents')
        .withIndex('product', (q) => q.eq('productId', product._id))
        .collect(),
    ]);
    return { product, profiles, states, edges, phase, browserRuns, influenceEvents };
  },
});

export const seedLedgerly = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query('products')
      .withIndex('slug', (q) => q.eq('slug', LEDGERLY_SLUG))
      .unique();
    if (existing) {
      if (existing.url !== LEDGERLY_URL) {
        await ctx.db.patch(existing._id, { url: LEDGERLY_URL });
      }
      return existing._id;
    }

    const now = Date.now();
    const productId = await ctx.db.insert('products', {
      slug: LEDGERLY_SLUG,
      name: 'Ledgerly',
      url: LEDGERLY_URL,
      analysisStatus: 'seeded',
      productModel: {
        category: 'Financial operations SaaS',
        primaryCta: 'Start free trial',
        claims: ['Real-time cash visibility', 'Automated financial workflows'],
        likelyConcerns: [
          'Requests bank access early',
          'Security of financial data',
          '$29 monthly price',
        ],
        conversionProxy: 'Reach the bank-connection boundary without connecting a real account',
      },
    });

    for (const resident of residentSeeds) {
      await ctx.db.insert('residentProfiles', {
        productId,
        residentKey: resident.residentKey,
        name: resident.name,
        role: resident.role,
        ...resident.traits,
      });
      const isPriya = resident.residentKey === 'priya';
      await ctx.db.insert('residentStates', {
        productId,
        residentKey: resident.residentKey,
        ...INITIAL_STATE,
        ...(isPriya
          ? {
              awareness: 1,
              curiosity: 0.65,
              trust: 0.32,
              purchaseIntent: 0.28,
              sentiment: -0.15,
              stage: 'evaluating' as const,
              expectedFriction: 0.7,
              productBeliefs: [
                {
                  claim: 'Ledgerly is useful, but asks for bank access too early',
                  confidence: 0.92,
                  source: 'priya',
                  origin: 'observed' as const,
                },
              ],
            }
          : {}),
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

    const browserRunId = await ctx.db.insert('browserRuns', {
      productId,
      residentKey: 'priya',
      runId: 'demo-prebaked-priya',
      status: 'completed',
      objective: 'Evaluate whether Ledgerly is suitable for agency finances',
      result: {
        outcome: 'Postponed at the early bank-connection boundary',
        pagesVisited: ['/', '/pricing', '/signup'],
        converted: false,
        frictions: ['Bank access requested before sufficient trust was established'],
        positiveSignals: ['Core cash visibility features looked useful'],
        trustDelta: -0.28,
        intentDelta: -0.2,
        shareLikelihood: 0.85,
      },
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert('scenarioPhases', {
      productId,
      slug: LEDGERLY_SLUG,
      phase: 'seeded',
      speed: 1,
      simulationDay: 1,
      elapsedSimulationMs: 0,
      updatedAt: now,
    });

    const priyaDescription = await ctx.db
      .query('playerDescriptions')
      .filter((q) => q.eq(q.field('name'), 'Priya'))
      .first();
    if (priyaDescription) {
      await ctx.db.insert('memories', {
        playerId: priyaDescription.playerId,
        description: 'Ledgerly looked useful, but asking for bank access so early felt sketchy.',
        importance: 8,
        lastAccess: now,
        data: {
          type: 'productExperience',
          productId,
          browserRunId,
          outcome: 'Postponed because bank access was requested too early',
          pagesVisited: ['/', '/pricing', '/signup'],
          observedAt: now,
        },
      });
    }
    return productId;
  },
});

export const startSimulation = mutation({
  args: {},
  handler: async (ctx) => {
    const phase = await ctx.db
      .query('scenarioPhases')
      .withIndex('slug', (q) => q.eq('slug', LEDGERLY_SLUG))
      .unique();
    if (!phase) throw new Error('Seed Ledgerly before starting the simulation');
    const now = Date.now();
    const states = await ctx.db
      .query('residentStates')
      .withIndex('product', (q) => q.eq('productId', phase.productId))
      .collect();
    for (const state of states) {
      const isPriya = state.residentKey === 'priya';
      await ctx.db.patch(state._id, {
        ...INITIAL_STATE,
        ...(isPriya
          ? {
              awareness: 1,
              curiosity: 0.65,
              trust: 0.32,
              purchaseIntent: 0.28,
              sentiment: -0.15,
              stage: 'evaluating' as const,
              expectedFriction: 0.7,
              productBeliefs: [
                {
                  claim: 'Ledgerly is useful, but asks for bank access too early',
                  confidence: 0.92,
                  source: 'priya',
                  origin: 'observed' as const,
                },
              ],
            }
          : {}),
        updatedAt: now,
      });
    }
    const previousEvents = await ctx.db
      .query('influenceEvents')
      .withIndex('product', (q) => q.eq('productId', phase.productId))
      .collect();
    for (const event of previousEvents) await ctx.db.delete(event._id);
    const previousRuns = await ctx.db
      .query('browserRuns')
      .withIndex('product', (q) => q.eq('productId', phase.productId))
      .collect();
    for (const run of previousRuns) {
      if (run.runId !== 'demo-prebaked-priya') await ctx.db.delete(run._id);
    }
    await ctx.db.patch(phase._id, {
      phase: 'priyaToRohan',
      elapsedSimulationMs: 0,
      startedAt: now,
      lastClockAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.launchTown.influenceActions.extractConversationInfluence,
      {
        productId: phase.productId,
        conversationId: 'demo-priya-rohan',
        speaker: 'priya',
        listener: 'rohan',
        transcript:
          'Priya: Ledgerly looked useful for cash visibility, but it asked for bank access far too early. That felt sketchy, so I postponed signup. Rohan: I trust your warning; I will investigate their security claims myself.',
      },
    );
  },
});

export const setSimulationSpeed = mutation({
  args: { speed: v.union(v.literal(1), v.literal(4), v.literal(16)) },
  handler: async (ctx, { speed }) => {
    const phase = await ctx.db
      .query('scenarioPhases')
      .withIndex('slug', (q) => q.eq('slug', LEDGERLY_SLUG))
      .unique();
    if (!phase) throw new Error('Seed Ledgerly before setting speed');
    await ctx.db.patch(phase._id, { speed, updatedAt: Date.now() });
  },
});

export const advanceScenarioClock = mutation({
  args: {},
  handler: async (ctx) => {
    const clock = await ctx.db
      .query('scenarioPhases')
      .withIndex('slug', (q) => q.eq('slug', LEDGERLY_SLUG))
      .unique();
    if (!clock || !clock.lastClockAt || clock.phase === 'seeded' || clock.phase === 'complete') {
      return clock?.phase ?? null;
    }
    const now = Date.now();
    const elapsedSimulationMs =
      clock.elapsedSimulationMs + Math.max(0, now - clock.lastClockAt) * clock.speed;
    const phase =
      elapsedSimulationMs >= 480_000
        ? ('complete' as const)
        : elapsedSimulationMs >= 300_000
          ? ('rohanToMeera' as const)
          : elapsedSimulationMs >= 120_000
            ? ('rohanBrowsing' as const)
            : ('priyaToRohan' as const);
    await ctx.db.patch(clock._id, {
      phase,
      elapsedSimulationMs,
      lastClockAt: now,
      updatedAt: now,
    });
    return phase;
  },
});
