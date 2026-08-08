// Maps the foundation's live Convex state (launchTown.scenario.getLedgerly)
// onto the UI contract in types.ts. Pure functions — no I/O.

import {
  Belief,
  BrowserRunView,
  FunnelStage,
  InfluencePulse,
  ResidentSnapshot,
  STAGE_ORDER,
  TownMetrics,
  clamp01,
} from './types';

// Loose doc shapes (subset of convex/schema.ts) so this file doesn't couple
// to convex server types.
export interface LiveProfile {
  residentKey: string;
  name: string;
  role: string;
}
export interface LiveState {
  residentKey: string;
  awareness: number;
  curiosity: number;
  trust: number;
  purchaseIntent: number;
  stage: string;
  productBeliefs: { claim: string; confidence: number; source: string; origin: string }[];
}
export interface LiveEdge {
  sourceResidentKey: string;
  targetResidentKey: string;
  relationshipStrength: number;
}
export interface LiveBrowserRun {
  residentKey: string;
  status: 'queued' | 'stubbed' | 'running' | 'ready' | 'completed' | 'failed';
  objective: string;
  // SECURITY: credential — iframe src only, never logged.
  liveViewUrl?: string;
  result?: {
    outcome: string;
    pagesVisited: string[];
    trustDelta: number;
    intentDelta: number;
  };
  createdAt: number;
  updatedAt: number;
}
export interface LiveInfluenceEvent {
  speaker: string;
  listener: string;
  appliedDeltas: { awareness: number; curiosity: number; trust: number };
  beliefs: { claim: string; confidence: number; source: string }[];
  causedBrowserRunId?: string;
  createdAt: number;
}
export interface LiveProduct {
  url: string;
  name: string;
  analysisStatus: 'seeded' | 'pending' | 'complete';
  productModel?: { category: string };
}
export interface LiveScenario {
  product?: LiveProduct;
  profiles: LiveProfile[];
  states: LiveState[];
  edges: LiveEdge[];
  browserRuns: LiveBrowserRun[];
  influenceEvents: LiveInfluenceEvent[];
  phase?: { phase: string } | null;
}

function mapStage(stage: string): FunnelStage {
  if (stage === 'evaluating') return 'considering';
  if ((STAGE_ORDER as string[]).includes(stage)) return stage as FunnelStage;
  return 'unaware';
}

function nameFor(profiles: LiveProfile[], residentKey: string): string {
  return profiles.find((p) => p.residentKey === residentKey)?.name ?? residentKey;
}

function latestRunFor(runs: LiveBrowserRun[], residentKey: string): LiveBrowserRun | undefined {
  return runs
    .filter((r) => r.residentKey === residentKey)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

function mapBrowser(run: LiveBrowserRun | undefined): BrowserRunView {
  if (!run) return { status: 'none' };
  const lastJourney = run.result
    ? {
        outcome: run.result.outcome,
        steps: run.result.pagesVisited.map((page) => ({ page })),
        trustDelta: run.result.trustDelta,
        intentDelta: run.result.intentDelta,
      }
    : undefined;
  switch (run.status) {
    case 'queued':
      return { status: 'pending', objective: run.objective, lastJourney };
    case 'running':
    case 'ready':
      return {
        status: 'running',
        objective: run.objective,
        liveViewUrl: run.liveViewUrl,
        lastJourney,
      };
    case 'stubbed':
    case 'completed':
      return { status: 'completed', objective: run.objective, lastJourney };
    case 'failed':
      return { status: 'failed', objective: run.objective, lastJourney };
  }
}

function mapBeliefs(state: LiveState, profiles: LiveProfile[]): Belief[] {
  return state.productBeliefs.map((b) => ({
    claim: b.claim,
    confidence: b.confidence,
    source:
      b.origin === 'hearsay'
        ? { kind: 'hearsay', from: nameFor(profiles, b.source) }
        : { kind: 'observed' },
  }));
}

export function liveSnapshots(data: LiveScenario): Map<string, ResidentSnapshot> {
  const out = new Map<string, ResidentSnapshot>();
  for (const profile of data.profiles) {
    const state = data.states.find((s) => s.residentKey === profile.residentKey);
    if (!state) continue;
    const run = latestRunFor(data.browserRuns, profile.residentKey);
    const browsing = run?.status === 'running' || run?.status === 'ready';
    const latestEvent = data.influenceEvents
      .filter(
        (e) => e.listener === profile.residentKey || e.speaker === profile.residentKey,
      )
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    out.set(profile.name, {
      resident: profile.name,
      role: profile.role,
      stage: mapStage(state.stage),
      bars: {
        awareness: clamp01(state.awareness),
        curiosity: clamp01(state.curiosity),
        trust: clamp01(state.trust),
        intent: clamp01(state.purchaseIntent),
      },
      beliefs: mapBeliefs(state, data.profiles),
      activity: browsing ? 'browsing' : 'idle',
      browser: mapBrowser(run),
      social: {
        relationships: data.edges
          .filter((e) => e.sourceResidentKey === profile.residentKey)
          .map((e) => ({
            name: nameFor(data.profiles, e.targetResidentKey),
            strength: e.relationshipStrength,
          })),
        recentConversation: latestEvent
          ? {
              with:
                latestEvent.listener === profile.residentKey
                  ? nameFor(data.profiles, latestEvent.speaker)
                  : nameFor(data.profiles, latestEvent.listener),
              lines: [],
              deltas: [
                { stat: 'awareness' as const, delta: latestEvent.appliedDeltas.awareness },
                { stat: 'curiosity' as const, delta: latestEvent.appliedDeltas.curiosity },
                { stat: 'trust' as const, delta: latestEvent.appliedDeltas.trust },
              ].filter((d) => Math.abs(d.delta) > 0.005),
              triggeredVisit: latestEvent.causedBrowserRunId
                ? 'Triggered website visit'
                : undefined,
            }
          : undefined,
      },
    });
  }
  return out;
}

const PULSE_VISIBLE_SEC = 7;

export function livePulses(data: LiveScenario, nowMs: number): InfluencePulse[] {
  return data.influenceEvents
    .filter((e) => (nowMs - e.createdAt) / 1000 < PULSE_VISIBLE_SEC)
    .map((e) => ({
      id: `${e.speaker}-${e.listener}-${e.createdAt}`,
      from: nameFor(data.profiles, e.speaker),
      to: nameFor(data.profiles, e.listener),
      deltas: [
        { stat: 'awareness' as const, delta: e.appliedDeltas.awareness },
        { stat: 'curiosity' as const, delta: e.appliedDeltas.curiosity },
        { stat: 'trust' as const, delta: e.appliedDeltas.trust },
      ].filter((d) => Math.abs(d.delta) > 0.005),
      ageSec: (nowMs - e.createdAt) / 1000,
    }));
}

export function liveMetrics(snapshots: Map<string, ResidentSnapshot>): TownMetrics {
  const counts = Object.fromEntries(STAGE_ORDER.map((s) => [s, 0])) as TownMetrics['stageCounts'];
  const avg = { awareness: 0, curiosity: 0, trust: 0, intent: 0 };
  for (const s of snapshots.values()) {
    counts[s.stage]++;
    avg.awareness += s.bars.awareness;
    avg.curiosity += s.bars.curiosity;
    avg.trust += s.bars.trust;
    avg.intent += s.bars.intent;
  }
  const n = Math.max(1, snapshots.size);
  return {
    avg: {
      awareness: clamp01(avg.awareness / n),
      curiosity: clamp01(avg.curiosity / n),
      trust: clamp01(avg.trust / n),
      intent: clamp01(avg.intent / n),
    },
    stageCounts: counts,
  };
}
