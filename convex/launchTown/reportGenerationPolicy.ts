export const MAX_REPORT_ATTEMPTS = 2;
export const REPORT_LEASE_MS = 10 * 60 * 1000;

export interface ExistingGeneration {
  status: 'running' | 'complete' | 'failed';
  attempts: number;
  leaseExpiresAt?: number;
  hasArtifact: boolean;
}

export type GenerationDecision = 'complete' | 'running' | 'exhausted' | 'granted';

export function hasRequiredRecommendationCount(artifact: {
  recommendations: readonly unknown[];
}): boolean {
  return artifact.recommendations.length === 3;
}

export function decideGeneration(
  existing: ExistingGeneration | null,
  now: number,
): GenerationDecision {
  if (!existing) return 'granted';
  if (existing.status === 'complete' && existing.hasArtifact) return 'complete';
  if (
    existing.status === 'running' &&
    existing.leaseExpiresAt !== undefined &&
    existing.leaseExpiresAt > now
  ) {
    return 'running';
  }
  if (existing.attempts >= MAX_REPORT_ATTEMPTS) return 'exhausted';
  return 'granted';
}
