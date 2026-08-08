import { decideNextAction, visitProbability } from './behavior';
import type { ResidentProfile, ResidentState } from './types';

const profile: ResidentProfile = {
  needStrength: 0.8,
  priceSensitivity: 0.4,
  technicalFluency: 0.8,
  trustThreshold: 0.72,
  socialSusceptibility: 0.5,
  noveltySeeking: 0.6,
  patience: 0.7,
};

const state: ResidentState = {
  residentKey: 'rohan',
  awareness: 0.7,
  curiosity: 0.65,
  trust: 0.55,
  purchaseIntent: 0.2,
  sentiment: 0,
  stage: 'evaluating',
  productBeliefs: [],
};

test('uses the specified visit sigmoid', () => {
  expect(visitProbability(profile, state, { socialProof: 0.7, expectedFriction: 0.3 })).toBeCloseTo(
    1 / (1 + Math.exp(-2.26)),
  );
});

test('browses when visit probability crosses the resident threshold', () => {
  expect(
    decideNextAction(profile, state, {
      socialProof: 0.7,
      expectedFriction: 0.3,
      hasAvailablePeer: true,
    }).kind,
  ).toBe('browse');
});

test('talks below the browse threshold when a peer is available', () => {
  expect(
    decideNextAction(
      { ...profile, needStrength: 0.05, trustThreshold: 0.95 },
      { ...state, awareness: 0.2, curiosity: 0, trust: 0.1 },
      { socialProof: 0, expectedFriction: 1, hasAvailablePeer: true },
    ).kind,
  ).toBe('talk');
});

test('idles below the threshold with no social opportunity', () => {
  expect(
    decideNextAction(
      { ...profile, needStrength: 0, trustThreshold: 0.95 },
      { ...state, awareness: 0, curiosity: 0, trust: 0 },
      { socialProof: 0, expectedFriction: 1, hasAvailablePeer: false },
    ).kind,
  ).toBe('idle');
});

