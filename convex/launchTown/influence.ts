import type {
  InfluenceEvent,
  ProductBelief,
  ResidentProfile,
  ResidentStage,
  ResidentState,
} from './types';

export type AppliedInfluence = {
  state: ResidentState;
  deltas: InfluenceEvent['signals'];
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function nextStage(current: ResidentStage, state: Pick<ResidentState, 'awareness' | 'curiosity'>) {
  if (current === 'converted' || current === 'rejected') return current;
  if (state.curiosity >= 0.6) return 'evaluating';
  if (state.curiosity >= 0.3) return 'considering';
  if (state.awareness >= 0.1) return 'aware';
  return 'unaware';
}

function mergeBeliefs(
  existing: ProductBelief[],
  incoming: InfluenceEvent['beliefs'],
  causalWeight: number,
): ProductBelief[] {
  const beliefs = existing.map((belief) => ({ ...belief }));
  for (const candidate of incoming) {
    const confidence = clamp(candidate.confidence * causalWeight);
    const index = beliefs.findIndex(
      (belief) => belief.claim.trim().toLowerCase() === candidate.claim.trim().toLowerCase(),
    );
    const nextBelief: ProductBelief = {
      claim: candidate.claim,
      confidence,
      source: candidate.source,
      origin: 'hearsay',
    };
    if (index === -1) beliefs.push(nextBelief);
    else if (beliefs[index].confidence <= confidence) beliefs[index] = nextBelief;
  }
  return beliefs;
}

/**
 * The deterministic boundary between Claude's semantic output and simulation state.
 * Claude supplies signals; this function alone owns the causal state transition.
 */
export function applyInfluence(
  event: InfluenceEvent,
  profile: ResidentProfile,
  relationshipStrength: number,
  current: ResidentState,
): AppliedInfluence {
  if (event.listener !== current.residentKey) {
    throw new Error(`Influence listener ${event.listener} does not match ${current.residentKey}`);
  }
  const causalWeight = clamp(relationshipStrength) * clamp(profile.socialSusceptibility);
  const awareness = clamp(current.awareness + clamp(event.signals.awareness, -1, 1) * causalWeight);
  const curiosity = clamp(current.curiosity + clamp(event.signals.curiosity, -1, 1) * causalWeight);
  const trust = clamp(current.trust + clamp(event.signals.trust, -1, 1) * causalWeight);
  const state: ResidentState = {
    ...current,
    awareness,
    curiosity,
    trust,
    productBeliefs: mergeBeliefs(current.productBeliefs, event.beliefs, causalWeight),
    stage: nextStage(current.stage, { awareness, curiosity }),
  };
  return {
    state,
    deltas: {
      awareness: awareness - current.awareness,
      curiosity: curiosity - current.curiosity,
      trust: trust - current.trust,
    },
  };
}
