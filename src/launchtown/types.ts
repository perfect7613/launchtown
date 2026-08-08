// LaunchTown domain types — the UI contract.
// The Convex foundation (PR #2) will expose queries returning these shapes;
// until then src/launchtown/demoScenario.ts provides a scripted stub.

export type FunnelStage = 'unaware' | 'aware' | 'considering' | 'converted' | 'rejected';

export const STAGE_META: Record<FunnelStage, { hex: number; css: string; label: string }> = {
  unaware: { hex: 0xf4f4f5, css: '#f4f4f5', label: 'Unaware' },
  aware: { hex: 0x60a5fa, css: '#60a5fa', label: 'Aware' },
  considering: { hex: 0xfacc15, css: '#facc15', label: 'Considering' },
  converted: { hex: 0x4ade80, css: '#4ade80', label: 'Converted' },
  rejected: { hex: 0xf87171, css: '#f87171', label: 'Rejected' },
};

export const STAGE_ORDER: FunnelStage[] = [
  'unaware',
  'aware',
  'considering',
  'converted',
  'rejected',
];

export type BeliefSource = { kind: 'hearsay'; from: string } | { kind: 'observed' };

export interface Belief {
  claim: string;
  confidence: number; // 0..1
  source: BeliefSource;
}

export interface StateBars {
  awareness: number;
  curiosity: number;
  trust: number;
  intent: number;
}

export type ResidentActivity = 'idle' | 'talking' | 'browsing';

export interface JourneyStep {
  page: string;
  note?: string;
}

export interface BrowserRunView {
  status: 'none' | 'pending' | 'running' | 'completed' | 'failed';
  // SECURITY: liveViewUrl is a credential. Never log it, never put it in
  // analytics, never render it as text — iframe src only.
  liveViewUrl?: string;
  objective?: string;
  lastJourney?: {
    outcome: string;
    steps: JourneyStep[];
    trustDelta?: number;
    intentDelta?: number;
  };
}

export interface Relationship {
  name: string;
  strength: number; // 0..1
}

export interface ConversationLine {
  speaker: string;
  text: string;
}

export interface InfluenceDelta {
  stat: keyof StateBars;
  delta: number; // signed, applied scale (e.g. -0.3)
}

export interface SocialView {
  relationships: Relationship[];
  recentConversation?: {
    with: string;
    lines: ConversationLine[];
    deltas: InfluenceDelta[];
    // e.g. 'Triggered website visit 2m later'
    triggeredVisit?: string;
  };
}

export interface ResidentSnapshot {
  resident: string;
  role: string;
  stage: FunnelStage;
  bars: StateBars;
  beliefs: Belief[];
  activity: ResidentActivity;
  browser: BrowserRunView;
  social: SocialView;
}

export interface InfluencePulse {
  id: string;
  from: string; // resident name
  to: string; // resident name
  deltas: InfluenceDelta[];
  ageSec: number; // seconds since the pulse fired (sim time)
}

export interface TownMetrics {
  avg: StateBars;
  stageCounts: Record<FunnelStage, number>;
}

export interface ProductEntry {
  url: string;
  createdAt: number;
  // set when the Convex mutation persisted it; absent = local stub
  convexId?: string;
}

export type InspectorTab = 'mind' | 'browser' | 'social';

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
