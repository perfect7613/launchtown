// LaunchTown UI state: product entry, simulation clock (1×/4×/16×),
// resident snapshots, influence pulses, and town metrics.
//
// Data source strategy:
//   1. If VITE_LAUNCHTOWN_LIVE is set, live Convex queries (liveApi.ts) win.
//   2. Otherwise the deterministic scripted cascade (demoScenario.ts) drives
//      everything, so the full demo spine works before the backend lands.

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMutation, useQuery } from 'convex/react';
import {
  InfluencePulse,
  ProductEntry,
  ResidentSnapshot,
  STAGE_ORDER,
  TownMetrics,
  clamp01,
} from './types';
import { RESIDENTS, scenarioPulses, scenarioSnapshot } from './demoScenario';
import {
  LAUNCHTOWN_LIVE,
  createProductRef,
  influencePulsesRef,
  residentOverviewsRef,
  townMetricsRef,
} from './liveApi';

const PRODUCT_KEY = 'launchtown.product';
const SIM_KEY = 'launchtown.sim';

export type SimSpeed = 1 | 4 | 16;

interface SimClock {
  running: boolean;
  // sim-seconds accumulated before the last speed change / pause
  baseSimSec: number;
  // wall-clock ms when the current segment started
  segmentStartMs: number;
  speed: SimSpeed;
}

function loadJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

function simSecondsOf(clock: SimClock, nowMs: number): number {
  if (!clock.running) return clock.baseSimSec;
  return clock.baseSimSec + ((nowMs - clock.segmentStartMs) / 1000) * clock.speed;
}

// Demo deep-link (plan §7 "seeded scenario"): ?product=<url> pre-fills the
// product entry and ?autostart=1 starts the scenario clock immediately, so
// the whole cascade is reachable from a single bookmarked URL.
function demoParams(): { productUrl?: string; autostart: boolean } {
  try {
    const params = new URLSearchParams(window.location.search);
    let productUrl = params.get('product') ?? undefined;
    if (!productUrl && window.location.pathname.includes('/demo')) {
      productUrl = 'https://ledgerly-demo.vercel.app';
    }
    return { productUrl, autostart: params.get('autostart') === '1' };
  } catch {
    return { autostart: false };
  }
}

export interface LaunchTownValue {
  product?: ProductEntry;
  createProduct: (url: string) => Promise<void>;
  resetProduct: () => void;

  simRunning: boolean;
  simSeconds: number;
  speed: SimSpeed;
  startSimulation: () => void;
  resetSimulation: () => void;
  setSpeed: (s: SimSpeed) => void;

  /** Resident snapshot for a sprite; player names map onto the 8 profiles. */
  residentForPlayer: (playerName: string, allPlayerNames: string[]) => ResidentSnapshot;
  /** Inverse mapping: which sprite plays a given resident. */
  playerNameForResident: (resident: string, allPlayerNames: string[]) => string | undefined;
  pulses: InfluencePulse[];
  metrics: (allPlayerNames: string[]) => TownMetrics;
}

export const LaunchTownContext = createContext<LaunchTownValue | undefined>(undefined);

/**
 * Map town player names onto the 8 resident profiles. If the world is seeded
 * with the real names (Priya, Rohan, ...) this is the identity; otherwise we
 * deterministically assign profiles to whatever sprites exist so the demo
 * cascade is visible with stock AI Town characters too.
 */
function buildAssignment(allPlayerNames: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const residentNames = RESIDENTS.map((r) => r.name);
  const unmatchedPlayers = allPlayerNames.filter((n) => !residentNames.includes(n)).sort();
  const usedResidents = new Set(allPlayerNames.filter((n) => residentNames.includes(n)));
  for (const n of usedResidents) map.set(n, n);
  const freeResidents = residentNames.filter((r) => !usedResidents.has(r));
  unmatchedPlayers.forEach((p, i) => {
    if (i < freeResidents.length) map.set(p, freeResidents[i]);
  });
  return map;
}

export function LaunchTownProvider({ children }: { children: ReactNode }) {
  const [product, setProduct] = useState<ProductEntry | undefined>(() => {
    const stored = loadJson<ProductEntry>(PRODUCT_KEY);
    if (stored) return stored;
    const { productUrl } = demoParams();
    if (productUrl) {
      const entry: ProductEntry = { url: productUrl, createdAt: Date.now() };
      saveJson(PRODUCT_KEY, entry);
      return entry;
    }
    return undefined;
  });
  const [clock, setClock] = useState<SimClock>(() => {
    const stored = loadJson<SimClock>(SIM_KEY);
    if (stored) return stored;
    const { autostart } = demoParams();
    return {
      running: autostart,
      baseSimSec: 0,
      segmentStartMs: Date.now(),
      speed: 1,
    };
  });
  const [nowMs, setNowMs] = useState(() => Date.now());

  // UI tick for bars / stage transitions (Pixi layers animate per-frame on
  // their own; 250ms is plenty for the DOM side).
  useEffect(() => {
    if (!clock.running) return;
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [clock.running]);

  const createProductMutation = useMutation(createProductRef);
  const createProduct = useCallback(
    async (url: string) => {
      const entry: ProductEntry = { url, createdAt: Date.now() };
      try {
        // Foundation mutation (PR #2). Falls back to local-only entry until it lands.
        const id = await createProductMutation({ url });
        if (typeof id === 'string') entry.convexId = id;
      } catch {
        // Mutation not deployed yet — local stub keeps the flow unblocked.
      }
      saveJson(PRODUCT_KEY, entry);
      setProduct(entry);
    },
    [createProductMutation],
  );

  const resetProduct = useCallback(() => {
    localStorage.removeItem(PRODUCT_KEY);
    localStorage.removeItem(SIM_KEY);
    setProduct(undefined);
    setClock({ running: false, baseSimSec: 0, segmentStartMs: Date.now(), speed: 1 });
  }, []);

  const startSimulation = useCallback(() => {
    setClock((c) => {
      const next: SimClock = c.running
        ? c
        : { ...c, running: true, segmentStartMs: Date.now() };
      saveJson(SIM_KEY, next);
      return next;
    });
  }, []);

  const resetSimulation = useCallback(() => {
    const next: SimClock = {
      running: false,
      baseSimSec: 0,
      segmentStartMs: Date.now(),
      speed: 1,
    };
    saveJson(SIM_KEY, next);
    setClock(next);
  }, []);

  const setSpeed = useCallback((s: SimSpeed) => {
    setClock((c) => {
      const now = Date.now();
      const next: SimClock = {
        ...c,
        baseSimSec: simSecondsOf(c, now),
        segmentStartMs: now,
        speed: s,
      };
      saveJson(SIM_KEY, next);
      return next;
    });
  }, []);

  const simSeconds = simSecondsOf(clock, nowMs);

  // ---- Live Convex overlays (opt-in until the foundation lands) ----
  const liveResidents = useQuery(
    residentOverviewsRef,
    LAUNCHTOWN_LIVE ? {} : 'skip',
  ) as ResidentSnapshot[] | undefined;
  const liveMetrics = useQuery(townMetricsRef, LAUNCHTOWN_LIVE ? {} : 'skip') as
    | TownMetrics
    | undefined;
  const livePulses = useQuery(influencePulsesRef, LAUNCHTOWN_LIVE ? {} : 'skip') as
    | InfluencePulse[]
    | undefined;

  const assignmentCache = useRef<{ key: string; map: Map<string, string> }>();
  const assignmentFor = useCallback((allPlayerNames: string[]) => {
    const key = [...allPlayerNames].sort().join('|');
    if (assignmentCache.current?.key !== key) {
      assignmentCache.current = { key, map: buildAssignment(allPlayerNames) };
    }
    return assignmentCache.current.map;
  }, []);

  const residentForPlayer = useCallback(
    (playerName: string, allPlayerNames: string[]): ResidentSnapshot => {
      const resident = assignmentFor(allPlayerNames).get(playerName) ?? playerName;
      const live = liveResidents?.find((r) => r.resident === resident);
      if (live) return live;
      return scenarioSnapshot(resident, simSeconds);
    },
    [assignmentFor, liveResidents, simSeconds],
  );

  const playerNameForResident = useCallback(
    (resident: string, allPlayerNames: string[]): string | undefined => {
      const map = assignmentFor(allPlayerNames);
      for (const [player, res] of map.entries()) {
        if (res === resident) return player;
      }
      return undefined;
    },
    [assignmentFor],
  );

  const pulses = useMemo<InfluencePulse[]>(() => {
    if (livePulses) return livePulses;
    if (!clock.running) return [];
    return scenarioPulses(simSeconds);
  }, [livePulses, clock.running, simSeconds]);

  const metrics = useCallback(
    (allPlayerNames: string[]): TownMetrics => {
      if (liveMetrics) return liveMetrics;
      const snapshots = allPlayerNames.map((n) => residentForPlayer(n, allPlayerNames));
      const counts = Object.fromEntries(STAGE_ORDER.map((s) => [s, 0])) as TownMetrics['stageCounts'];
      const avg = { awareness: 0, curiosity: 0, trust: 0, intent: 0 };
      for (const s of snapshots) {
        counts[s.stage]++;
        avg.awareness += s.bars.awareness;
        avg.curiosity += s.bars.curiosity;
        avg.trust += s.bars.trust;
        avg.intent += s.bars.intent;
      }
      const n = Math.max(1, snapshots.length);
      return {
        avg: {
          awareness: clamp01(avg.awareness / n),
          curiosity: clamp01(avg.curiosity / n),
          trust: clamp01(avg.trust / n),
          intent: clamp01(avg.intent / n),
        },
        stageCounts: counts,
      };
    },
    [liveMetrics, residentForPlayer],
  );

  const value = useMemo<LaunchTownValue>(
    () => ({
      product,
      createProduct,
      resetProduct,
      simRunning: clock.running,
      simSeconds,
      speed: clock.speed,
      startSimulation,
      resetSimulation,
      setSpeed,
      residentForPlayer,
      playerNameForResident,
      pulses,
      metrics,
    }),
    [
      product,
      createProduct,
      resetProduct,
      clock.running,
      clock.speed,
      simSeconds,
      startSimulation,
      resetSimulation,
      setSpeed,
      residentForPlayer,
      playerNameForResident,
      pulses,
      metrics,
    ],
  );

  return <LaunchTownContext.Provider value={value}>{children}</LaunchTownContext.Provider>;
}

export function useLaunchTown(): LaunchTownValue {
  const ctx = useContext(LaunchTownContext);
  if (!ctx) throw new Error('useLaunchTown must be used inside LaunchTownProvider');
  return ctx;
}
