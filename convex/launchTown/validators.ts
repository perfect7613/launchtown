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

export const browserRunSource = v.union(
  v.literal('live'),
  v.literal('fallback'),
  v.literal('error'),
);

export const browserSessionStatus = v.union(
  v.literal('PENDING'),
  v.literal('RUNNING'),
  v.literal('ERROR'),
  v.literal('TIMED_OUT'),
  v.literal('COMPLETED'),
);

export const outboundCallStatus = v.union(
  v.literal('initiated'),
  v.literal('ringing'),
  v.literal('in-progress'),
  v.literal('completed'),
  v.literal('failed'),
);

export const bolnaExecutionStatus = v.union(
  v.literal('scheduled'),
  v.literal('queued'),
  v.literal('rescheduled'),
  v.literal('initiated'),
  v.literal('ringing'),
  v.literal('in-progress'),
  v.literal('call-disconnected'),
  v.literal('completed'),
  v.literal('balance-low'),
  v.literal('busy'),
  v.literal('no-answer'),
  v.literal('canceled'),
  v.literal('failed'),
  v.literal('stopped'),
  v.literal('error'),
);

export const outboundFailureCode = v.union(
  v.literal('provider_rejected'),
  v.literal('provider_unavailable'),
  v.literal('poll_timeout'),
  v.literal('balance_low'),
  v.literal('busy'),
  v.literal('no_answer'),
  v.literal('canceled'),
  v.literal('failed'),
);

export const safeCallFinding = v.object({
  label: v.string(),
  summary: v.string(),
  confidence: v.optional(v.number()),
});
