import { applyInfluence } from './influence';
import type { InfluenceEvent, ResidentProfile, ResidentState } from './types';

const profile: ResidentProfile = {
  needStrength: 0.8,
  priceSensitivity: 0.4,
  technicalFluency: 0.8,
  trustThreshold: 0.7,
  socialSusceptibility: 0.5,
  noveltySeeking: 0.6,
  patience: 0.7,
};

const state: ResidentState = {
  residentKey: 'rohan',
  awareness: 0.1,
  curiosity: 0.2,
  trust: 0.8,
  purchaseIntent: 0.1,
  sentiment: 0,
  stage: 'aware',
  productBeliefs: [],
};

const event: InfluenceEvent = {
  listener: 'rohan',
  signals: { awareness: 0.8, curiosity: 0.4, trust: -0.3 },
  beliefs: [{ claim: 'asks for bank access early', confidence: 0.72, source: 'priya' }],
  behavioralSuggestion: 'investigate',
};

test('applies semantic signals through relationship strength and susceptibility', () => {
  const result = applyInfluence(event, profile, 0.9, state);

  expect(result.deltas.awareness).toBeCloseTo(0.36);
  expect(result.deltas.curiosity).toBeCloseTo(0.18);
  expect(result.deltas.trust).toBeCloseTo(-0.135);
  expect(result.state.productBeliefs).toEqual([
    {
      claim: 'asks for bank access early',
      confidence: 0.324,
      source: 'priya',
      origin: 'hearsay',
    },
  ]);
  expect(result.state.stage).toBe('considering');
});

test('clamps state deltas at externally visible bounds', () => {
  const result = applyInfluence(
    { ...event, signals: { awareness: 1, curiosity: 1, trust: 1 } },
    { ...profile, socialSusceptibility: 1 },
    1,
    { ...state, awareness: 0.9, curiosity: 0.95, trust: 0.99 },
  );

  expect(result.state.awareness).toBe(1);
  expect(result.state.curiosity).toBe(1);
  expect(result.state.trust).toBe(1);
});

test('rejects an event addressed to a different resident', () => {
  expect(() => applyInfluence({ ...event, listener: 'meera' }, profile, 0.9, state)).toThrow(
    'does not match',
  );
});
