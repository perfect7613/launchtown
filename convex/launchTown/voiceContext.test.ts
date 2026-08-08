import { BOLNA_USER_DATA_LIMIT_BYTES, serializeResidentVoiceContext } from './voiceContext';

const context = {
  product: { name: 'Ledgerly', url: 'https://ledgerly-demo-six.vercel.app' },
  profile: {
    name: 'Rohan',
    role: 'Technical founder who verifies claims',
    needStrength: 0.85,
    priceSensitivity: 0.45,
    technicalFluency: 0.95,
    trustThreshold: 0.7,
    socialSusceptibility: 0.65,
    noveltySeeking: 0.8,
    patience: 0.75,
  },
  state: {
    stage: 'evaluating',
    productBeliefs: [
      {
        claim: 'The security docs are solid',
        confidence: 0.85,
        source: 'rohan',
        origin: 'observed',
      },
      {
        claim: 'Bank access is requested early',
        confidence: 0.72,
        source: 'Priya',
        origin: 'hearsay',
      },
    ],
  },
  experiences: [
    { outcome: 'Checked security before signup', pagesVisited: ['/security', '/signup'] },
  ],
  hearsay: [{ claim: 'The bank request felt sketchy', source: 'Priya', confidence: 0.9 }],
};

test('serializes live resident context into the exact Bolna prompt variables', () => {
  const result = serializeResidentVoiceContext(context);

  expect(Object.keys(result).sort()).toEqual([
    'beliefs',
    'experiences',
    'hearsay',
    'name',
    'opening_assessment',
    'personality',
    'product',
    'stage',
  ]);
  expect(result.name).toBe('Rohan');
  expect(result.product).toContain('Ledgerly');
  expect(result.opening_assessment).toBe(
    'My first take on Ledgerly: Checked security before signup. The security docs are solid.',
  );
  expect(result.opening_assessment).not.toContain('https://');
  expect(result.personality).toContain('technical fluency 95%');
  expect(result.beliefs).toContain('heard from Priya');
  expect(result.experiences).toContain('/security');
  expect(result.hearsay).toContain('Priya said');
  expect(result.stage).toBe('evaluating');
});

test('keeps oversized live context below Bolna 50 KB userData limit', () => {
  const result = serializeResidentVoiceContext({
    ...context,
    state: {
      ...context.state,
      productBeliefs: Array.from({ length: 200 }, (_, index) => ({
        claim: `${index}: ${'security concern '.repeat(200)}`,
        confidence: 0.8,
        source: 'Priya',
        origin: 'hearsay',
      })),
    },
    experiences: Array.from({ length: 200 }, (_, index) => ({
      outcome: `${index}: ${'website experience '.repeat(200)}`,
    })),
    hearsay: Array.from({ length: 200 }, (_, index) => ({
      claim: `${index}: ${'trusted warning '.repeat(200)}`,
      source: 'Priya',
      confidence: 0.9,
    })),
  });

  expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThanOrEqual(
    BOLNA_USER_DATA_LIMIT_BYTES,
  );
});
