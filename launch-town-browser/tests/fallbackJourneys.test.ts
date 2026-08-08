import { describe, expect, it } from "vitest";
import {
  DEMO_RESIDENT_NAMES,
  FALLBACK_JOURNEY_NOTICE,
  getFallbackJourney,
} from "../src/fallbackJourneys.js";
import { BrowserJourneyOutputSchema } from "../src/schemas.js";

describe("getFallbackJourney", () => {
  it("provides a valid cached journey for every seeded resident", () => {
    for (const residentName of DEMO_RESIDENT_NAMES) {
      const journey = getFallbackJourney(residentName);

      expect(journey).toMatchObject({
        source: "lastCompletedJourney",
        notice: FALLBACK_JOURNEY_NOTICE,
        residentName,
      });
      expect(BrowserJourneyOutputSchema.safeParse(journey?.output).success).toBe(
        true,
      );
    }
  });

  it("preserves the critical hearsay-driven security-first Rohan journey", () => {
    const journey = getFallbackJourney("rohan");

    expect(journey?.output.pagesVisited[0]).toBe(
      "https://ledgerly-demo-six.vercel.app/security",
    );
    expect(journey?.output.trustDelta).toBeGreaterThan(0);
    expect(journey?.output.positiveSignals.join(" ")).toMatch(/security/i);
  });

  it("returns no fallback for an unknown resident", () => {
    expect(getFallbackJourney("Unknown Resident")).toBeUndefined();
  });

  it("returns defensive copies", () => {
    const first = getFallbackJourney("Priya");
    first?.output.pagesVisited.push("https://malicious.example");

    expect(getFallbackJourney("Priya")?.output.pagesVisited).not.toContain(
      "https://malicious.example",
    );
  });
});
