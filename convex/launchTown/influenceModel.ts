import { v } from 'convex/values';
import { internalMutation, internalQuery } from '../_generated/server';
import { playerId } from '../aiTown/ids';
import { applyInfluence } from './influence';
import type { ResidentProfile, ResidentState } from './types';
import { behavioralSuggestion, influenceSignals, transferredBelief } from './validators';

export const activeProduct = internalQuery({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query('products')
      .withIndex('slug', (q) => q.eq('slug', 'ledgerly'))
      .unique(),
});

export const applyExtractedInfluence = internalMutation({
  args: {
    productId: v.id('products'),
    conversationId: v.string(),
    speaker: v.string(),
    listener: v.string(),
    transcript: v.string(),
    event: v.object({
      listener: v.string(),
      signals: influenceSignals,
      beliefs: v.array(transferredBelief),
      behavioralSuggestion,
    }),
  },
  handler: async (ctx, args) => {
    const profileDoc = await ctx.db
      .query('residentProfiles')
      .withIndex('product_resident', (q) =>
        q.eq('productId', args.productId).eq('residentKey', args.listener),
      )
      .unique();
    const stateDoc = await ctx.db
      .query('residentStates')
      .withIndex('product_resident', (q) =>
        q.eq('productId', args.productId).eq('residentKey', args.listener),
      )
      .unique();
    const edge = await ctx.db
      .query('socialEdges')
      .withIndex('source_target', (q) =>
        q
          .eq('productId', args.productId)
          .eq('sourceResidentKey', args.speaker)
          .eq('targetResidentKey', args.listener),
      )
      .unique();
    if (!profileDoc || !stateDoc) throw new Error('Resident profile/state missing for influence');

    const result = applyInfluence(
      args.event,
      profileDoc as ResidentProfile,
      edge?.relationshipStrength ?? 0.2,
      stateDoc as ResidentState,
    );
    const relationshipStrength = edge?.relationshipStrength ?? 0.2;
    await ctx.db.patch(stateDoc._id, {
      awareness: result.state.awareness,
      curiosity: result.state.curiosity,
      trust: result.state.trust,
      stage: result.state.stage,
      productBeliefs: result.state.productBeliefs,
      socialProof: Math.min(1, stateDoc.socialProof + Math.max(0, result.deltas.trust) * 0.5),
      updatedAt: Date.now(),
    });
    await ctx.db.insert('influenceEvents', {
      productId: args.productId,
      conversationId: args.conversationId,
      speaker: args.speaker,
      listener: args.listener,
      signals: args.event.signals,
      beliefs: args.event.beliefs,
      behavioralSuggestion: args.event.behavioralSuggestion,
      relationshipStrength,
      socialSusceptibility: profileDoc.socialSusceptibility,
      appliedDeltas: result.deltas,
      createdAt: Date.now(),
    });
    const playerDescription = await ctx.db
      .query('playerDescriptions')
      .filter((q) => q.eq(q.field('name'), profileDoc.name))
      .first();
    return { ...result, playerId: playerDescription?.playerId };
  },
});

export const insertHearsayMemory = internalMutation({
  args: {
    productId: v.id('products'),
    playerId,
    sourceResidentKey: v.string(),
    description: v.string(),
    beliefs: v.array(transferredBelief),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const belief of args.beliefs) {
      const embeddingId = await ctx.db.insert('memoryEmbeddings', {
        playerId: args.playerId,
        embedding: args.embedding,
      });
      await ctx.db.insert('memories', {
        playerId: args.playerId,
        embeddingId,
        description: args.description,
        importance: 7,
        lastAccess: now,
        data: {
          type: 'productHearsay',
          productId: args.productId,
          sourceResidentKey: args.sourceResidentKey,
          claim: belief.claim,
          confidence: belief.confidence,
          heardAt: now,
        },
      });
    }
  },
});
