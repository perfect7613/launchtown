// Seam to the LaunchTown Convex functions landing in the foundation PR (#2).
// We reference them by name so this compiles before `_generated/api` knows
// about them. Live queries are opt-in via VITE_LAUNCHTOWN_LIVE=1; the
// createProduct mutation is always attempted and falls back to local state.
//
// Expected server contract (coordinate in PR comments):
//   mutation launchtown:createProduct  { url: string } -> productId
//   query    launchtown:residentOverviews { worldId } -> ResidentSnapshot[]
//   query    launchtown:townMetrics       { worldId } -> TownMetrics
//   query    launchtown:influencePulses   { worldId } -> InfluencePulse[]

import { makeFunctionReference } from 'convex/server';

export const LAUNCHTOWN_LIVE = !!import.meta.env.VITE_LAUNCHTOWN_LIVE;

export const createProductRef = makeFunctionReference<'mutation'>('launchtown:createProduct');
export const residentOverviewsRef = makeFunctionReference<'query'>('launchtown:residentOverviews');
export const townMetricsRef = makeFunctionReference<'query'>('launchtown:townMetrics');
export const influencePulsesRef = makeFunctionReference<'query'>('launchtown:influencePulses');
