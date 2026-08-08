import { v } from 'convex/values';
import { query } from '../_generated/server';

const productArgs = { productId: v.id('products') };

function residentKeyForName(name: string): string {
  return name.trim().toLowerCase();
}

/** Read-only evidence exposed to the Launch Report agent. */
export const getInfluenceEvents = query({
  args: productArgs,
  handler: async (ctx, { productId }) => {
    const events = await ctx.db
      .query('influenceEvents')
      .withIndex('product', (q) => q.eq('productId', productId))
      .collect();
    return events.map((event) => ({
      speaker: event.speaker,
      listener: event.listener,
      signals: event.signals,
      beliefs: event.beliefs,
      behavioralSuggestion: event.behavioralSuggestion,
      appliedDeltas: event.appliedDeltas,
      causedBrowserRunId: event.causedBrowserRunId,
      createdAt: event.createdAt,
    }));
  },
});

/** Live-view URLs and provider run IDs are intentionally excluded. */
export const getBrowserRuns = query({
  args: productArgs,
  handler: async (ctx, { productId }) => {
    const simulationRuns = await ctx.db
      .query('simulationRuns')
      .withIndex('product', (q) => q.eq('productId', productId))
      .order('desc')
      .collect();
    const latestCompleted = simulationRuns.find((run) => run.status === 'completed');
    if (!latestCompleted) return [];
    const runs = await ctx.db
      .query('browserRuns')
      .withIndex('product', (q) => q.eq('productId', productId))
      .collect();
    return runs.filter((run) => run.simulationRunId === latestCompleted.runId).map((run) => ({
      residentKey: run.residentKey,
      status: run.status,
      sessionId: run.sessionId,
      sessionStatus: run.sessionStatus,
      source: run.source,
      objective: run.objective,
      result: run.result,
      fallbackNotice: run.fallbackNotice,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    }));
  },
});

export const getSimulationRun = query({
  args: productArgs,
  handler: async (ctx, { productId }) => {
    const runs = await ctx.db
      .query('simulationRuns')
      .withIndex('product', (q) => q.eq('productId', productId))
      .order('desc')
      .collect();
    const run = runs.find((candidate) => candidate.status === 'completed');
    if (!run) return null;
    return {
      runId: run.runId,
      status: run.status,
      speed: run.speed,
      coveredPersonaKeys: run.coveredPersonaKeys,
      conversationEvidence: run.conversationEvidence,
      startedAt: run.startedAt,
      simulationCompletedAt: run.simulationCompletedAt,
      completedAt: run.completedAt,
    };
  },
});

export const getResidentStates = query({
  args: productArgs,
  handler: async (ctx, { productId }) => {
    const product = await ctx.db.get(productId);
    if (!product) throw new Error('Product not found');
    const [profiles, states] = await Promise.all([
      ctx.db
        .query('residentProfiles')
        .withIndex('product', (q) => q.eq('productId', productId))
        .collect(),
      ctx.db
        .query('residentStates')
        .withIndex('product', (q) => q.eq('productId', productId))
        .collect(),
    ]);
    return {
      product: {
        name: product.name,
        url: product.url,
        productModel: product.productModel,
      },
      residents: profiles.map((profile) => {
        const state = states.find((candidate) => candidate.residentKey === profile.residentKey);
        return {
          residentKey: profile.residentKey,
          name: profile.name,
          role: profile.role,
          traits: {
            needStrength: profile.needStrength,
            priceSensitivity: profile.priceSensitivity,
            technicalFluency: profile.technicalFluency,
            trustThreshold: profile.trustThreshold,
            socialSusceptibility: profile.socialSusceptibility,
            noveltySeeking: profile.noveltySeeking,
            patience: profile.patience,
          },
          state: state
            ? {
                awareness: state.awareness,
                curiosity: state.curiosity,
                trust: state.trust,
                purchaseIntent: state.purchaseIntent,
                sentiment: state.sentiment,
                stage: state.stage,
                productBeliefs: state.productBeliefs,
                socialProof: state.socialProof,
                expectedFriction: state.expectedFriction,
                updatedAt: state.updatedAt,
              }
            : null,
        };
      }),
    };
  },
});

export const getMemories = query({
  args: productArgs,
  handler: async (ctx, { productId }) => {
    const memories = await ctx.db
      .query('memories')
      .withIndex('product', (q) => q.eq('data.productId', productId))
      .collect();
    const playerIds = [...new Set(memories.map((memory) => memory.playerId))];
    const descriptions = await Promise.all(
      playerIds.map((playerId) =>
        ctx.db
          .query('playerDescriptions')
          .withIndex('playerId', (q) => q.eq('playerId', playerId))
          .first(),
      ),
    );
    const names = new Map(
      descriptions
        .filter(
          (description): description is NonNullable<(typeof descriptions)[number]> =>
            description !== null,
        )
        .map((description) => [description.playerId, description.name]),
    );
    return memories
      .filter(
        (memory) =>
          (memory.data.type === 'productExperience' || memory.data.type === 'productHearsay') &&
          memory.data.productId === productId,
      )
      .map((memory) => {
        const residentName = names.get(memory.playerId) ?? String(memory.playerId);
        return {
          residentKey: residentKeyForName(residentName),
          residentName,
          description: memory.description,
          importance: memory.importance,
          lastAccess: memory.lastAccess,
          data: memory.data,
        };
      });
  },
});
