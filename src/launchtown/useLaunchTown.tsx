// LaunchTown UI state: product entry, simulation clock (1×/4×/16×),
// resident snapshots, influence pulses, and town metrics.
//
// Data source strategy:
//   1. When the foundation's Ledgerly scenario is seeded and running
//      (launchTown.scenario.getLedgerly), live Convex state wins.
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
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import {
  InfluencePulse,
  ProductEntry,
  ResidentSnapshot,
  STAGE_ORDER,
  TownMetrics,
  clamp01,
} from './types';
import { RESIDENTS, scenarioPulses, scenarioSnapshot } from './demoScenario';
import { LEDGERLY_DEMO_URL, migrateStoredDemoProduct } from './demoProduct';
import { LiveScenario, livePulses, liveSnapshots, liveMetrics } from './liveAdapter';

const PRODUCT_KEY = 'launchtown.product';
const SIM_KEY = 'launchtown.sim';

export type SimSpeed = 1 | 4 | 16;
export const SIMULATION_DURATION_SECONDS = 8 * 60;

interface SimClock {
  running: boolean;
  completed: boolean;
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
function demoParams(): { productUrl?: string; autostart: boolean; usesDefaultProduct: boolean } {
  try {
    const params = new URLSearchParams(window.location.search);
    let productUrl = params.get('product') ?? undefined;
    let usesDefaultProduct = false;
    if (!productUrl && window.location.pathname.includes('/demo')) {
      productUrl = LEDGERLY_DEMO_URL;
      usesDefaultProduct = true;
    }
    return { productUrl, autostart: params.get('autostart') === '1', usesDefaultProduct };
  } catch {
    return { autostart: false, usesDefaultProduct: false };
  }
}

export interface LaunchTownValue {
  product?: ProductEntry;
  createProduct: (url: string) => Promise<void>;
  resetProduct: () => void;

  simRunning: boolean;
  simComplete: boolean;
  simSeconds: number;
  simDurationSeconds: number;
  speed: SimSpeed;
  productAnalysisStatus?: 'seeded' | 'pending' | 'running' | 'complete' | 'failed';
  productCategory?: string;
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

// Fetches the live scenario inside an error boundary so a missing/renamed
// Convex function can never take down the demo — we just stay in stub mode.
function LiveScenarioBridge({
  productId,
  onData,
}: {
  productId?: Id<'products'>;
  onData: (d: LiveScenario | null | undefined) => void;
}) {
  const custom = useQuery(
    api.launchTown.products.getScenario,
    productId ? { productId } : 'skip',
  ) as LiveScenario | null | undefined;
  const ledgerly = useQuery(
    api.launchTown.scenario.getLedgerly,
    productId ? 'skip' : {},
  ) as LiveScenario | null | undefined;
  const data = productId ? custom : ledgerly;
  useEffect(() => {
    onData(data);
  }, [data, onData]);
  return null;
}

class LiveBoundary extends React.Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // Live Convex state unavailable — the scripted cascade keeps the demo alive.
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function LaunchTownProvider({ children }: { children: ReactNode }) {
  const [product, setProduct] = useState<ProductEntry | undefined>(() => {
    const { productUrl, usesDefaultProduct } = demoParams();
    const originalStored = loadJson<ProductEntry>(PRODUCT_KEY);
    const stored = migrateStoredDemoProduct(originalStored, usesDefaultProduct);
    if (stored) {
      if (stored !== originalStored) saveJson(PRODUCT_KEY, stored);
      return stored;
    }
    if (productUrl) {
      const entry: ProductEntry = { url: productUrl, createdAt: Date.now() };
      saveJson(PRODUCT_KEY, entry);
      return entry;
    }
    return undefined;
  });
  const [clock, setClock] = useState<SimClock>(() => {
    const stored = loadJson<SimClock>(SIM_KEY);
    if (stored) return { ...stored, completed: stored.completed ?? false };
    const { autostart } = demoParams();
    return {
      running: autostart,
      completed: false,
      baseSimSec: 0,
      segmentStartMs: Date.now(),
      speed: 1,
    };
  });
  const [nowMs, setNowMs] = useState(() => Date.now());

  // ---- Live Convex state from the foundation (launchTown.scenario) ----
  // When the Ledgerly scenario is seeded and running, its resident states,
  // browser runs, and influence events drive the UI; the scripted demo
  // cascade is the fallback so the app demos with zero backend.
  const [liveScenario, setLiveScenario] = useState<LiveScenario | null | undefined>();
  const liveActive =
    !!liveScenario &&
    liveScenario.states.length > 0 &&
    (!!product?.convexId || (!!liveScenario.phase && liveScenario.phase.phase !== 'seeded'));
  const liveData = liveActive ? liveScenario : undefined;

  // UI tick for bars / stage transitions / pulse fade (Pixi layers animate
  // per-frame on their own; 250ms is plenty for the DOM side).
  useEffect(() => {
    if (!clock.running && !liveData) return;
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [clock.running, liveData]);

  const persistProduct = useMutation(api.launchTown.products.create);
  const createProduct = useCallback(
    async (url: string) => {
      const entry: ProductEntry = { url, createdAt: Date.now() };
      const id = await persistProduct({ url });
      entry.convexId = id;
      saveJson(PRODUCT_KEY, entry);
      setProduct(entry);
    },
    [persistProduct],
  );

  const resetProduct = useCallback(() => {
    localStorage.removeItem(PRODUCT_KEY);
    localStorage.removeItem(SIM_KEY);
    setProduct(undefined);
    setClock({
      running: false,
      completed: false,
      baseSimSec: 0,
      segmentStartMs: Date.now(),
      speed: 1,
    });
  }, []);

  const startSimulation = useCallback(() => {
    setClock((c) => {
      const next: SimClock = c.running
        ? c
        : {
            ...c,
            running: true,
            completed: false,
            baseSimSec: c.completed ? 0 : c.baseSimSec,
            segmentStartMs: Date.now(),
          };
      saveJson(SIM_KEY, next);
      return next;
    });
  }, []);

  const resetSimulation = useCallback(() => {
    const next: SimClock = {
      running: false,
      completed: false,
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

  const rawSimSeconds = simSecondsOf(clock, nowMs);
  const simSeconds = Math.min(SIMULATION_DURATION_SECONDS, rawSimSeconds);
  useEffect(() => {
    if (!clock.running || rawSimSeconds < SIMULATION_DURATION_SECONDS) return;
    setClock((current) => {
      if (!current.running) return current;
      const next = {
        ...current,
        running: false,
        completed: true,
        baseSimSec: SIMULATION_DURATION_SECONDS,
        segmentStartMs: Date.now(),
      };
      saveJson(SIM_KEY, next);
      return next;
    });
  }, [clock.running, rawSimSeconds]);

  const scenarioSeconds = (simSeconds / SIMULATION_DURATION_SECONDS) * 80;

  const liveSnapshotMap = useMemo(
    () => (liveData ? liveSnapshots(liveData) : undefined),
    [liveData],
  );

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
      const live = liveSnapshotMap?.get(resident);
      if (live) return live;
      return scenarioSnapshot(resident, scenarioSeconds);
    },
    [assignmentFor, liveSnapshotMap, scenarioSeconds],
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
    if (liveData) return livePulses(liveData, nowMs);
    if (!clock.running) return [];
    return scenarioPulses(scenarioSeconds);
  }, [liveData, nowMs, clock.running, scenarioSeconds]);

  const metrics = useCallback(
    (allPlayerNames: string[]): TownMetrics => {
      if (liveSnapshotMap) return liveMetrics(liveSnapshotMap);
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
    [liveSnapshotMap, residentForPlayer],
  );

  const value = useMemo<LaunchTownValue>(
    () => ({
      product,
      createProduct,
      resetProduct,
      simRunning: clock.running,
      simComplete: clock.completed,
      simSeconds,
      simDurationSeconds: SIMULATION_DURATION_SECONDS,
      speed: clock.speed,
      productAnalysisStatus: liveScenario?.product?.analysisStatus,
      productCategory: liveScenario?.product?.productModel?.category,
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
      clock.completed,
      clock.speed,
      liveScenario?.product?.analysisStatus,
      liveScenario?.product?.productModel?.category,
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

  return (
    <LaunchTownContext.Provider value={value}>
      <LiveBoundary>
        <LiveScenarioBridge
          productId={product?.convexId as Id<'products'> | undefined}
          onData={setLiveScenario}
        />
      </LiveBoundary>
      {children}
    </LaunchTownContext.Provider>
  );
}

export function useLaunchTown(): LaunchTownValue {
  const ctx = useContext(LaunchTownContext);
  if (!ctx) throw new Error('useLaunchTown must be used inside LaunchTownProvider');
  return ctx;
}
