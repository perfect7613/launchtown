import { describe, expect, it, vi } from "vitest";
import { BrowserUseV2JourneyRunner } from "../src/browserJourneyRunnerV2.js";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("BrowserUseV2JourneyRunner", () => {
  it("creates a budgeted, unrecorded V2 task with structured output", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ id: "task-1", sessionId: "session-1" }, 202),
    );
    const runner = new BrowserUseV2JourneyRunner({
      apiKey: "test-key",
      fetch: fetcher,
    });

    await expect(runner.createRun("Browse naturally.")).resolves.toEqual({
      runId: "task-1",
      sessionId: "session-1",
      status: "queued",
      cursor: 0,
    });

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("https://api.browser-use.com/api/v2/tasks");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      llm: "browser-use-2.0",
      maxSteps: 20,
      judge: false,
      thinking: false,
      sessionSettings: { proxyCountryCode: "us", enableRecording: false },
    });
    expect(JSON.parse(String(body.structuredOutput))).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
  });

  it("returns the session live view and completed structured journey", async () => {
    const liveViewUrl = "https://live.browser-use.com/?credential=secret";
    const output = {
      outcome: "Reviewed and left.",
      pagesVisited: ["https://example.com"],
      converted: false,
      frictions: [],
      positiveSignals: ["Clear page"],
      trustDelta: 0.05,
      intentDelta: 0,
      shareLikelihood: 0.3,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ liveUrl: liveViewUrl }))
      .mockResolvedValueOnce(
        jsonResponse({ status: "finished", output: JSON.stringify(output) }),
      );
    const runner = new BrowserUseV2JourneyRunner({
      apiKey: "test-key",
      fetch: fetcher,
    });

    await expect(
      runner.pollRun({
        runId: "task-1",
        sessionId: "session-1",
        status: "running",
        cursor: 0,
      }),
    ).resolves.toEqual({
      runId: "task-1",
      sessionId: "session-1",
      status: "completed",
      cursor: 0,
      terminal: true,
      liveViewUrl,
      output,
    });
  });
});
