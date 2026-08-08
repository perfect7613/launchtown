import {
  decideGeneration,
  hasRequiredRecommendationCount,
  MAX_REPORT_ATTEMPTS,
  REPORT_LEASE_MS,
  latestRunAllowsReport,
} from './reportGenerationPolicy';

const now = 1_000_000;

test('grants the first report attempt', () => {
  expect(decideGeneration(null, now)).toBe('granted');
});

test('returns a completed cached report instead of granting another attempt', () => {
  expect(
    decideGeneration(
      { status: 'complete', attempts: 1, hasArtifact: true, leaseExpiresAt: undefined },
      now,
    ),
  ).toBe('complete');
});

test('rejects a concurrent attempt while the lease is active', () => {
  expect(
    decideGeneration(
      {
        status: 'running',
        attempts: 1,
        hasArtifact: false,
        leaseExpiresAt: now + REPORT_LEASE_MS,
      },
      now,
    ),
  ).toBe('running');
});

test('permits one bounded retry after failure or lease expiry', () => {
  expect(
    decideGeneration(
      { status: 'failed', attempts: 1, hasArtifact: false, leaseExpiresAt: undefined },
      now,
    ),
  ).toBe('granted');
  expect(
    decideGeneration(
      { status: 'running', attempts: 1, hasArtifact: false, leaseExpiresAt: now - 1 },
      now,
    ),
  ).toBe('granted');
});

test('exhausts the server-owned retry budget', () => {
  expect(
    decideGeneration(
      {
        status: 'failed',
        attempts: MAX_REPORT_ATTEMPTS,
        hasArtifact: false,
        leaseExpiresAt: undefined,
      },
      now,
    ),
  ).toBe('exhausted');
});

test('accepts exactly three persisted recommendations', () => {
  expect(hasRequiredRecommendationCount({ recommendations: [{}, {}, {}] })).toBe(true);
  expect(hasRequiredRecommendationCount({ recommendations: [{}, {}] })).toBe(false);
  expect(hasRequiredRecommendationCount({ recommendations: [{}, {}, {}, {}] })).toBe(false);
});

test('allows reports only for the latest terminal completed run', () => {
  expect(latestRunAllowsReport('completed')).toBe(true);
  expect(latestRunAllowsReport('running')).toBe(false);
  expect(latestRunAllowsReport('simulation_complete')).toBe(false);
  expect(latestRunAllowsReport('failed')).toBe(false);
  expect(latestRunAllowsReport(undefined)).toBe(false);
});
