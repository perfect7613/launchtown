import type { ResidentProfile, ResidentState } from './types';

export type NextAction =
  | { kind: 'browse'; visitProbability: number }
  | { kind: 'talk'; visitProbability: number }
  | { kind: 'idle'; visitProbability: number };

export type SocialContext = {
  socialProof: number;
  expectedFriction: number;
  hasAvailablePeer: boolean;
  visitThreshold?: number;
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

export function visitProbability(
  profile: Pick<ResidentProfile, 'needStrength'>,
  state: Pick<ResidentState, 'awareness' | 'curiosity' | 'trust'>,
  social: Pick<SocialContext, 'socialProof' | 'expectedFriction'>,
) {
  const score =
    1.2 * clamp(profile.needStrength) +
    0.8 * clamp(state.awareness) +
    1.0 * clamp(state.curiosity) +
    0.9 * clamp(social.socialProof) -
    0.8 * (1 - clamp(state.trust)) -
    0.6 * clamp(social.expectedFriction);
  return sigmoid(score);
}

/** Pure policy layered above the AI Town agent operation; tick mechanics stay untouched. */
export function decideNextAction(
  profile: ResidentProfile,
  state: ResidentState,
  social: SocialContext,
): NextAction {
  const probability = visitProbability(profile, state, social);
  const threshold = clamp(social.visitThreshold ?? profile.trustThreshold);
  if (probability >= threshold && state.stage !== 'converted' && state.stage !== 'rejected') {
    return { kind: 'browse', visitProbability: probability };
  }
  if (social.hasAvailablePeer && state.awareness >= 0.1) {
    return { kind: 'talk', visitProbability: probability };
  }
  return { kind: 'idle', visitProbability: probability };
}
