import { describe, expect, it } from "vitest";
import { BrowserUseJourneyRunner } from "../src/browserJourneyRunner.js";
import { BrowserUseV2JourneyRunner } from "../src/browserJourneyRunnerV2.js";
import { BrowserbaseStagehandJourneyRunner } from "../src/browserbaseJourneyRunner.js";
import { createBrowserJourneyBackend } from "../src/journeyBackend.js";

describe("createBrowserJourneyBackend", () => {
  it("defaults to the no-credit fallback backend", () => {
    const backend = createBrowserJourneyBackend();

    expect(backend.kind).toBe("fallback");
    if (backend.kind === "fallback") {
      expect(backend.getJourney("Rohan")?.source).toBe(
        "lastCompletedJourney",
      );
    }
  });

  it("selects each live adapter through the same mode flag", () => {
    const browserbase = createBrowserJourneyBackend({
      mode: "browserbase",
      browserbase: {
        browserbaseApiKey: "bb-key",
        browserbaseProjectId: "project-1",
        anthropicApiKey: "anthropic-key",
      },
    });
    const v2 = createBrowserJourneyBackend({
      mode: "v2",
      v2: { apiKey: "test-key" },
    });
    const v4 = createBrowserJourneyBackend({
      mode: "v4",
      v4: { apiKey: "test-key" },
    });

    expect(browserbase.kind).toBe("live");
    expect(v2.kind).toBe("live");
    expect(v4.kind).toBe("live");
    if (
      browserbase.kind === "live" &&
      v2.kind === "live" &&
      v4.kind === "live"
    ) {
      expect(browserbase.runner).toBeInstanceOf(
        BrowserbaseStagehandJourneyRunner,
      );
      expect(v2.runner).toBeInstanceOf(BrowserUseV2JourneyRunner);
      expect(v4.runner).toBeInstanceOf(BrowserUseJourneyRunner);
    }
  });

  it("rejects an invalid mode instead of accidentally starting a live run", () => {
    expect(() =>
      createBrowserJourneyBackend({
        mode: "paid" as "fallback",
      }),
    ).toThrow(
      "BROWSER_JOURNEY_MODE must be one of: fallback, browserbase, v2, v4.",
    );
  });
});
