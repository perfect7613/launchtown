import {
  BrowserUseJourneyRunner,
  type BrowserJourneyRunner,
  type BrowserUseJourneyRunnerOptions,
} from "./browserJourneyRunner.js";
import {
  BrowserUseV2JourneyRunner,
  type BrowserUseV2JourneyRunnerOptions,
} from "./browserJourneyRunnerV2.js";
import {
  getFallbackJourney,
  type FallbackJourney,
} from "./fallbackJourneys.js";
import {
  BrowserbaseStagehandJourneyRunner,
  type BrowserbaseStagehandRunnerOptions,
} from "./browserbaseJourneyRunner.js";

export const BROWSER_JOURNEY_MODE_ENV = "BROWSER_JOURNEY_MODE";

export type BrowserJourneyMode = "fallback" | "browserbase" | "v2" | "v4";

export type BrowserJourneyBackend =
  | {
      kind: "fallback";
      getJourney(residentName: string): FallbackJourney | undefined;
    }
  | {
      kind: "live";
      apiVersion: "browserbase" | "v2" | "v4";
      runner: BrowserJourneyRunner;
    };

export interface BrowserJourneyBackendOptions {
  mode?: BrowserJourneyMode;
  browserbase?: BrowserbaseStagehandRunnerOptions;
  v2?: BrowserUseV2JourneyRunnerOptions;
  v4?: BrowserUseJourneyRunnerOptions;
}

/**
 * Selects the safe fallback or one live API adapter through one configuration
 * flag. The default never creates a cloud client or consumes browser credits.
 */
export function createBrowserJourneyBackend(
  options: BrowserJourneyBackendOptions = {},
): BrowserJourneyBackend {
  const mode = parseMode(options.mode ?? process.env[BROWSER_JOURNEY_MODE_ENV]);

  if (mode === "fallback") {
    return { kind: "fallback", getJourney: getFallbackJourney };
  }
  if (mode === "v2") {
    return {
      kind: "live",
      apiVersion: "v2",
      runner: new BrowserUseV2JourneyRunner(options.v2),
    };
  }
  if (mode === "browserbase") {
    return {
      kind: "live",
      apiVersion: "browserbase",
      runner: new BrowserbaseStagehandJourneyRunner(options.browserbase),
    };
  }
  return {
    kind: "live",
    apiVersion: "v4",
    runner: new BrowserUseJourneyRunner(options.v4),
  };
}

function parseMode(value: string | undefined): BrowserJourneyMode {
  if (!value || value === "fallback") return "fallback";
  if (value === "browserbase" || value === "v2" || value === "v4") return value;
  throw new Error(
    `${BROWSER_JOURNEY_MODE_ENV} must be one of: fallback, browserbase, v2, v4.`,
  );
}
