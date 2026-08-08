import { v } from 'convex/values';

export const reportArtifactValidator = v.object({
  productName: v.string(),
  productUrl: v.string(),
  executiveSummary: v.string(),
  topFrictions: v.array(
    v.object({
      title: v.string(),
      severity: v.union(v.literal('high'), v.literal('medium'), v.literal('low')),
      residents: v.array(v.string()),
      evidence: v.array(v.string()),
    }),
  ),
  beliefSpread: v.array(
    v.object({
      belief: v.string(),
      source: v.string(),
      listeners: v.array(
        v.object({
          resident: v.string(),
          evidence: v.string(),
          behaviorChange: v.string(),
        }),
      ),
    }),
  ),
  funnelOutcomes: v.array(
    v.object({
      resident: v.string(),
      stage: v.string(),
      outcome: v.string(),
      pagesVisited: v.array(v.string()),
      converted: v.boolean(),
      evidence: v.string(),
    }),
  ),
  recommendations: v.array(
    v.object({
      title: v.string(),
      priority: v.union(v.literal('P0'), v.literal('P1'), v.literal('P2')),
      fix: v.string(),
      rationale: v.string(),
      evidence: v.array(v.string()),
    }),
  ),
  sessionId: v.string(),
  generatedAt: v.string(),
  markdown: v.string(),
});
