import { v } from 'convex/values';
import { mutation, query } from '../_generated/server';

export const begin = mutation({
  args: {
    productId: v.id('products'),
    runId: v.string(),
    speed: v.union(v.literal(1), v.literal(4), v.literal(16)),
  },
  handler: async (ctx, args) => {
    if (!/^[a-zA-Z0-9-]{8,128}$/.test(args.runId)) throw new Error('Invalid run ID');
    const existing = await ctx.db
      .query('simulationRuns')
      .withIndex('run', (q) => q.eq('runId', args.runId))
      .unique();
    if (existing) return existing._id;
    const profiles = await ctx.db
      .query('residentProfiles')
      .withIndex('product', (q) => q.eq('productId', args.productId))
      .collect();
    if (profiles.length < 2) throw new Error('At least two personas are required');
    const oldReports = await ctx.db
      .query('launchReports')
      .withIndex('product', (q) => q.eq('productId', args.productId))
      .collect();
    for (const report of oldReports) await ctx.db.delete(report._id);
    return await ctx.db.insert('simulationRuns', {
      ...args,
      status: 'running',
      expectedPersonaKeys: profiles.map((profile) => profile.residentKey).sort(),
      coveredPersonaKeys: [],
      conversationEvidence: [],
      browserPhaseComplete: false,
      startedAt: Date.now(),
    });
  },
});

export const completeSimulation = mutation({
  args: { productId: v.id('products'), runId: v.string() },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query('simulationRuns')
      .withIndex('run', (q) => q.eq('runId', args.runId))
      .unique();
    if (!run || run.productId !== args.productId) throw new Error('Simulation run not found');
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    const world = worldStatus ? await ctx.db.get(worldStatus.worldId) : null;
    const control = world?.simulationControl;
    if (!control || control.runId !== args.runId) throw new Error('Simulation evidence unavailable');
    const descriptions = worldStatus
      ? await ctx.db
          .query('playerDescriptions')
          .withIndex('worldId', (q) => q.eq('worldId', worldStatus.worldId))
          .collect()
      : [];
    const keyByPlayer = new Map(
      descriptions.map((description) => [description.playerId, description.name.toLowerCase()]),
    );
    const coveredPersonaKeys = [...new Set(
      control.participantIds.map((playerId) => keyByPlayer.get(playerId)).filter(Boolean),
    )] as string[];
    const conversationEvidence = (control.conversationPairs ?? []).flatMap((pair) => {
      const speaker = keyByPlayer.get(pair.speakerId);
      const peer = keyByPlayer.get(pair.peerId);
      return speaker && peer ? [{ speaker, peer }] : [];
    });
    const missing = run.expectedPersonaKeys.filter((key) => !coveredPersonaKeys.includes(key));
    const now = Date.now();
    if (missing.length > 0) {
      await ctx.db.patch(run._id, {
        status: 'failed',
        coveredPersonaKeys,
        conversationEvidence,
        simulationCompletedAt: now,
        failureReason: `Conversation coverage incomplete: ${missing.join(', ')}`,
      });
      return { status: 'failed' as const, missing };
    }
    const status = run.browserPhaseComplete ? ('completed' as const) : ('simulation_complete' as const);
    await ctx.db.patch(run._id, {
      status,
      coveredPersonaKeys,
      conversationEvidence,
      simulationCompletedAt: now,
      ...(status === 'completed' ? { completedAt: now } : {}),
    });
    return { status, missing: [] };
  },
});

export const latest = query({
  args: { productId: v.id('products') },
  handler: async (ctx, { productId }) =>
    await ctx.db
      .query('simulationRuns')
      .withIndex('product', (q) => q.eq('productId', productId))
      .order('desc')
      .first(),
});
