import { describe, expect, it } from "vitest";
import { interpretBrowserResult } from "../src/resultInterpreter.js";

describe("interpretBrowserResult", () => {
  it("maps valid browser output to deterministic deltas and a memory payload", () => {
    const interpreted = interpretBrowserResult(
      JSON.stringify({
        outcome: "Security documentation addressed the main concern.",
        pagesVisited: ["/", "/security", "/signup"],
        converted: false,
        frictions: ["Bank connection appeared before value was established"],
        positiveSignals: ["Detailed encryption documentation"],
        trustDelta: 0.18,
        intentDelta: 0.08,
        shareLikelihood: 0.72,
      }),
    );

    expect(interpreted).toEqual({
      ok: true,
      value: {
        stateDeltas: { trust: 0.18, purchaseIntent: 0.08 },
        memory: {
          type: "productExperience",
          summary: "Security documentation addressed the main concern.",
          details: {
            pagesVisited: ["/", "/security", "/signup"],
            converted: false,
            frictions: [
              "Bank connection appeared before value was established",
            ],
            positiveSignals: ["Detailed encryption documentation"],
            shareLikelihood: 0.72,
          },
        },
      },
    });
  });

  it.each([
    "not JSON",
    JSON.stringify({ outcome: "missing most fields" }),
    JSON.stringify({
      outcome: "Out-of-range deltas",
      pagesVisited: [],
      converted: false,
      frictions: [],
      positiveSignals: [],
      trustDelta: 2,
      intentDelta: 0,
      shareLikelihood: -1,
    }),
  ])("safely rejects malformed output", (input) => {
    const interpreted = interpretBrowserResult(input);

    expect(interpreted.ok).toBe(false);
    if (!interpreted.ok) {
      expect(interpreted.error.code).toBe("invalid_browser_output");
      expect(interpreted.error.issues.length).toBeGreaterThan(0);
    }
  });
});
