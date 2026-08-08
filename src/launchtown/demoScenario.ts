// Scripted P0 cascade (plan §7) used as the stub data source until the
// Convex foundation exposes live resident state. Everything is a pure
// function of sim-time so the demo is deterministic and replayable.
//
//   Priya (pre-baked visit, bank-connection felt sketchy)
//     → talks to Rohan (awareness↑ curiosity↑ trust↓)
//     → Rohan browses, checks /security first
//     → trust +18% → tells Meera → Meera trust↑

import {
  Belief,
  BrowserRunView,
  clamp01,
  FunnelStage,
  InfluencePulse,
  ResidentActivity,
  ResidentSnapshot,
  SocialView,
  StateBars,
} from './types';

export const RESIDENTS: { name: string; role: string }[] = [
  { name: 'Priya', role: 'Agency owner · high trust threshold' },
  { name: 'Rohan', role: 'Technical founder · verifies claims' },
  { name: 'Meera', role: 'Freelancer · price-sensitive' },
  { name: 'Ananya', role: 'Small-business operator' },
  { name: 'Dev', role: 'Early adopter · novelty-seeker' },
  { name: 'Karan', role: 'Skeptic · high social influence' },
  { name: 'Sneha', role: 'Finance lead · security-sensitive' },
  { name: 'Aarav', role: 'Independent consultant' },
];

// Cascade timeline (sim-seconds).
const T = {
  talkPriyaRohanStart: 5,
  influencePriyaRohan: 12,
  talkPriyaRohanEnd: 18,
  rohanBrowseStart: 22,
  rohanBrowseEnd: 46,
  talkRohanMeeraStart: 52,
  influenceRohanMeera: 58,
  talkRohanMeeraEnd: 68,
};

// Linear ramp helper: value moves v0→v1 across [t0, t1].
function ramp(t: number, t0: number, t1: number, v0: number, v1: number): number {
  if (t <= t0) return v0;
  if (t >= t1) return v1;
  return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PRIYA_JOURNEY: BrowserRunView['lastJourney'] = {
  outcome: 'Left at signup — early bank-connection request',
  steps: [
    { page: '/', note: 'liked the positioning' },
    { page: '/pricing', note: '$29/mo felt fair' },
    { page: '/signup', note: 'asked to connect bank before showing product — bailed' },
  ],
  trustDelta: -0.2,
  intentDelta: -0.15,
};

const ROHAN_JOURNEY: BrowserRunView['lastJourney'] = {
  outcome: 'Reached signup — security concern resolved',
  steps: [
    { page: '/security', note: 'checked FIRST — because of what Priya said' },
    { page: '/', note: 'skimmed features' },
    { page: '/pricing', note: 'fine for a startup' },
    { page: '/signup', note: 'noted the bank ask, but docs justified it' },
  ],
  trustDelta: 0.18,
  intentDelta: 0.22,
};

function priya(t: number): ResidentSnapshot {
  const talking = t >= T.talkPriyaRohanStart && t < T.talkPriyaRohanEnd;
  const bars: StateBars = {
    awareness: 0.92,
    curiosity: 0.4,
    trust: 0.32,
    intent: 0.25,
  };
  const beliefs: Belief[] = [
    { claim: 'Asks for bank access very early', confidence: 0.9, source: { kind: 'observed' } },
    { claim: 'Core features look genuinely useful', confidence: 0.75, source: { kind: 'observed' } },
  ];
  const social: SocialView = {
    relationships: [
      { name: 'Rohan', strength: 0.9 },
      { name: 'Ananya', strength: 0.5 },
      { name: 'Sneha', strength: 0.4 },
    ],
    recentConversation:
      t >= T.influencePriyaRohan
        ? {
            with: 'Rohan',
            lines: [
              {
                speaker: 'Priya',
                text: 'Ledgerly looked genuinely useful, but they asked to connect my bank before showing anything. Felt sketchy.',
              },
              {
                speaker: 'Rohan',
                text: "That's a red flag. I'd want to see their security story before touching it.",
              },
            ],
            deltas: [
              { stat: 'awareness', delta: 0.8 },
              { stat: 'curiosity', delta: 0.4 },
              { stat: 'trust', delta: -0.3 },
            ],
            triggeredVisit: t >= T.rohanBrowseStart ? 'Triggered website visit 2m later' : undefined,
          }
        : undefined,
  };
  return {
    resident: 'Priya',
    role: RESIDENTS[0].role,
    stage: 'considering',
    bars,
    beliefs,
    activity: talking ? 'talking' : 'idle',
    browser: { status: 'completed', lastJourney: PRIYA_JOURNEY },
    social,
  };
}

function rohan(t: number): ResidentSnapshot {
  const heard = t >= T.influencePriyaRohan;
  const browsing = t >= T.rohanBrowseStart && t < T.rohanBrowseEnd;
  const browsed = t >= T.rohanBrowseEnd;
  const talkingPriya = t >= T.talkPriyaRohanStart && t < T.talkPriyaRohanEnd;
  const talkingMeera = t >= T.talkRohanMeeraStart && t < T.talkRohanMeeraEnd;

  const bars: StateBars = {
    awareness: ramp(t, T.influencePriyaRohan - 2, T.influencePriyaRohan + 2, 0.05, 0.85),
    curiosity: ramp(t, T.influencePriyaRohan - 2, T.influencePriyaRohan + 2, 0.2, 0.65),
    trust: browsed
      ? ramp(t, T.rohanBrowseEnd, T.rohanBrowseEnd + 4, 0.25, 0.62)
      : ramp(t, T.influencePriyaRohan - 2, T.influencePriyaRohan + 2, 0.5, 0.25),
    intent: browsed ? 0.72 : ramp(t, T.rohanBrowseStart, T.rohanBrowseEnd, 0.1, 0.35),
  };

  let stage: FunnelStage = 'unaware';
  if (browsed) stage = 'converted';
  else if (t >= T.rohanBrowseStart) stage = 'considering';
  else if (heard) stage = 'aware';

  const beliefs: Belief[] = [];
  if (heard) {
    beliefs.push({
      claim: 'Asks for bank access very early',
      confidence: 0.72,
      source: { kind: 'hearsay', from: 'Priya' },
    });
    beliefs.push({
      claim: 'Core features look useful',
      confidence: 0.5,
      source: { kind: 'hearsay', from: 'Priya' },
    });
  }
  if (browsed) {
    beliefs.push({
      claim: 'Security docs are actually solid',
      confidence: 0.85,
      source: { kind: 'observed' },
    });
  }

  const browser: BrowserRunView = browsing
    ? {
        status: 'running',
        objective: "Check whether Priya's security concern is justified",
        // No liveViewUrl in the stub → the Browser tab exercises the
        // "live browser unavailable" fallback path.
        lastJourney: undefined,
      }
    : browsed
      ? { status: 'completed', lastJourney: ROHAN_JOURNEY }
      : { status: 'none' };

  const social: SocialView = {
    relationships: [
      { name: 'Priya', strength: 0.9 },
      { name: 'Meera', strength: 0.7 },
      { name: 'Dev', strength: 0.45 },
    ],
    recentConversation: talkingMeera || t >= T.talkRohanMeeraEnd
      ? {
          with: 'Meera',
          lines: [
            {
              speaker: 'Rohan',
              text: 'Priya was right about the bank thing, but their security docs are actually solid.',
            },
            {
              speaker: 'Meera',
              text: 'Huh. Might be worth a look if the price makes sense.',
            },
          ],
          deltas: [
            { stat: 'awareness', delta: 0.7 },
            { stat: 'trust', delta: 0.25 },
          ],
        }
      : heard
        ? {
            with: 'Priya',
            lines: [
              {
                speaker: 'Priya',
                text: 'They asked to connect my bank before showing anything. Felt sketchy.',
              },
              {
                speaker: 'Rohan',
                text: "I'd want to see their security story before touching it.",
              },
            ],
            deltas: [
              { stat: 'awareness', delta: 0.8 },
              { stat: 'curiosity', delta: 0.4 },
              { stat: 'trust', delta: -0.3 },
            ],
            triggeredVisit:
              t >= T.rohanBrowseStart ? 'Triggered website visit 2m later' : undefined,
          }
        : undefined,
  };

  let activity: ResidentActivity = 'idle';
  if (browsing) activity = 'browsing';
  else if (talkingPriya || talkingMeera) activity = 'talking';

  return { resident: 'Rohan', role: RESIDENTS[1].role, stage, bars, beliefs, activity, browser, social };
}

function meera(t: number): ResidentSnapshot {
  const heard = t >= T.influenceRohanMeera;
  const talking = t >= T.talkRohanMeeraStart && t < T.talkRohanMeeraEnd;
  const bars: StateBars = {
    awareness: ramp(t, T.influenceRohanMeera - 2, T.influenceRohanMeera + 2, 0.02, 0.6),
    curiosity: ramp(t, T.influenceRohanMeera - 2, T.influenceRohanMeera + 2, 0.15, 0.5),
    trust: ramp(t, T.influenceRohanMeera - 2, T.influenceRohanMeera + 2, 0.4, 0.58),
    intent: heard ? 0.3 : 0.05,
  };
  const beliefs: Belief[] = heard
    ? [
        {
          claim: 'Asks for bank access early, but security is solid',
          confidence: 0.6,
          source: { kind: 'hearsay', from: 'Rohan' },
        },
      ]
    : [];
  return {
    resident: 'Meera',
    role: RESIDENTS[2].role,
    stage: heard ? 'considering' : 'unaware',
    bars,
    beliefs,
    activity: talking ? 'talking' : 'idle',
    browser: { status: 'none' },
    social: {
      relationships: [
        { name: 'Rohan', strength: 0.7 },
        { name: 'Aarav', strength: 0.5 },
      ],
      recentConversation: heard
        ? {
            with: 'Rohan',
            lines: [
              {
                speaker: 'Rohan',
                text: 'Priya was right about the bank thing, but their security docs are actually solid.',
              },
              { speaker: 'Meera', text: 'Huh. Might be worth a look if the price makes sense.' },
            ],
            deltas: [
              { stat: 'awareness', delta: 0.7 },
              { stat: 'trust', delta: 0.25 },
            ],
          }
        : undefined,
    },
  };
}

function ambient(name: string, role: string, t: number): ResidentSnapshot {
  const h = hashStr(name);
  const drift = clamp01(((h % 100) / 100) * 0.2 + t * 0.001);
  const aware = t > 30 + (h % 40);
  return {
    resident: name,
    role,
    stage: aware ? 'aware' : 'unaware',
    bars: {
      awareness: aware ? 0.3 + drift : 0.02 + drift * 0.2,
      curiosity: 0.15 + ((h >> 3) % 30) / 100,
      trust: 0.45 + ((h >> 5) % 20) / 100,
      intent: 0.05,
    },
    beliefs: aware
      ? [
          {
            claim: 'Some new finance tool is going around town',
            confidence: 0.3,
            source: { kind: 'hearsay', from: 'the town' },
          },
        ]
      : [],
    activity: 'idle',
    browser: { status: 'none' },
    social: {
      relationships: [
        { name: 'Karan', strength: 0.4 },
        { name: 'Dev', strength: 0.35 },
      ].filter((r) => r.name !== name),
    },
  };
}

export function scenarioSnapshot(resident: string, simSec: number): ResidentSnapshot {
  switch (resident) {
    case 'Priya':
      return priya(simSec);
    case 'Rohan':
      return rohan(simSec);
    case 'Meera':
      return meera(simSec);
    default: {
      const def = RESIDENTS.find((r) => r.name === resident);
      return ambient(resident, def?.role ?? 'Resident', simSec);
    }
  }
}

const PULSE_VISIBLE_SEC = 7;

export function scenarioPulses(simSec: number): InfluencePulse[] {
  const defs = [
    {
      id: 'priya-rohan',
      at: T.influencePriyaRohan,
      from: 'Priya',
      to: 'Rohan',
      deltas: [
        { stat: 'awareness' as const, delta: 0.8 },
        { stat: 'curiosity' as const, delta: 0.4 },
        { stat: 'trust' as const, delta: -0.3 },
      ],
    },
    {
      id: 'rohan-meera',
      at: T.influenceRohanMeera,
      from: 'Rohan',
      to: 'Meera',
      deltas: [
        { stat: 'awareness' as const, delta: 0.7 },
        { stat: 'trust' as const, delta: 0.25 },
      ],
    },
  ];
  return defs
    .filter((d) => simSec >= d.at && simSec < d.at + PULSE_VISIBLE_SEC)
    .map((d) => ({ id: d.id, from: d.from, to: d.to, deltas: d.deltas, ageSec: simSec - d.at }));
}
