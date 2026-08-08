import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { reportArtifactValidator } from './reportArtifactValidator';
import {
  decideGeneration,
  hasRequiredRecommendationCount,
  latestRunAllowsReport,
  REPORT_LEASE_MS,
} from './reportGenerationPolicy';

const gateArgs = {
  productId: v.id('products'),
  gateSecret: v.string(),
};

function authorize(gateSecret: string): void {
  const expected = process.env.LAUNCH_REPORT_GATE_SECRET;
  if (!expected || gateSecret !== expected) throw new Error('Not authorized');
}

export const begin = mutation({
  args: { ...gateArgs, leaseId: v.string() },
  handler: async (ctx, { productId, gateSecret, leaseId }) => {
    authorize(gateSecret);
    const product = await ctx.db.get(productId);
    if (!product) return { state: 'not_found' as const };
    const runs = await ctx.db
      .query('simulationRuns')
      .withIndex('product', (q) => q.eq('productId', productId))
      .order('desc')
      .collect();
    if (!latestRunAllowsReport(runs[0]?.status)) {
      return { state: 'not_ready' as const };
    }

    const existing = await ctx.db
      .query('launchReports')
      .withIndex('product', (q) => q.eq('productId', productId))
      .unique();
    const now = Date.now();
    const decision = decideGeneration(
      existing
        ? {
            status: existing.status,
            attempts: existing.attempts,
            leaseExpiresAt: existing.leaseExpiresAt,
            hasArtifact: existing.artifact !== undefined,
          }
        : null,
      now,
    );
    if (decision === 'complete') {
      return { state: 'complete' as const, artifact: existing!.artifact! };
    }
    if (decision === 'running' || decision === 'exhausted') {
      return { state: decision };
    }

    const leaseExpiresAt = now + REPORT_LEASE_MS;
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: 'running',
        attempts: existing.attempts + 1,
        leaseId,
        leaseExpiresAt,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('launchReports', {
        productId,
        status: 'running',
        attempts: 1,
        leaseId,
        leaseExpiresAt,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { state: 'granted' as const };
  },
});

export const complete = mutation({
  args: { ...gateArgs, leaseId: v.string(), artifact: reportArtifactValidator },
  handler: async (ctx, { productId, gateSecret, leaseId, artifact }) => {
    authorize(gateSecret);
    if (!hasRequiredRecommendationCount(artifact)) {
      throw new Error('Launch Report must contain exactly three recommendations');
    }
    const report = await ctx.db
      .query('launchReports')
      .withIndex('product', (q) => q.eq('productId', productId))
      .unique();
    if (!report || report.status !== 'running' || report.leaseId !== leaseId) {
      throw new Error('Launch Report lease is no longer active');
    }
    await ctx.db.patch(report._id, {
      status: 'complete',
      artifact,
      leaseId: undefined,
      leaseExpiresAt: undefined,
      lastError: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const fail = mutation({
  args: { ...gateArgs, leaseId: v.string(), error: v.string() },
  handler: async (ctx, { productId, gateSecret, leaseId, error }) => {
    authorize(gateSecret);
    const report = await ctx.db
      .query('launchReports')
      .withIndex('product', (q) => q.eq('productId', productId))
      .unique();
    if (!report || report.status !== 'running' || report.leaseId !== leaseId) return;
    await ctx.db.patch(report._id, {
      status: 'failed',
      leaseId: undefined,
      leaseExpiresAt: undefined,
      lastError: error.slice(0, 500),
      updatedAt: Date.now(),
    });
  },
});
