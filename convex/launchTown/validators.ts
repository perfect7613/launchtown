import { v } from 'convex/values';

export const residentStage = v.union(
  v.literal('unaware'),
  v.literal('aware'),
  v.literal('considering'),
  v.literal('evaluating'),
  v.literal('converted'),
  v.literal('rejected'),
);

export const productBelief = v.object({
  claim: v.string(),
  confidence: v.number(),
  source: v.string(),
  origin: v.union(v.literal('observed'), v.literal('hearsay')),
});

export const influenceSignals = v.object({
  awareness: v.number(),
  curiosity: v.number(),
  trust: v.number(),
});

export const transferredBelief = v.object({
  claim: v.string(),
  confidence: v.number(),
  source: v.string(),
});

export const behavioralSuggestion = v.union(
  v.literal('investigate'),
  v.literal('visit'),
  v.literal('avoid'),
  v.literal('share'),
  v.literal('none'),
);

export const browserResult = v.object({
  outcome: v.string(),
  pagesVisited: v.array(v.string()),
  converted: v.boolean(),
  frictions: v.array(v.string()),
  positiveSignals: v.array(v.string()),
  trustDelta: v.number(),
  intentDelta: v.number(),
  shareLikelihood: v.number(),
});

