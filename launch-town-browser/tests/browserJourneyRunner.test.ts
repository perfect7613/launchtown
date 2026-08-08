import { describe, expect, it, vi } from "vitest";
import { BrowserUseJourneyRunner } from "../src/browserJourneyRunner.js";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("BrowserUseJourneyRunner", () => {
  it("creates an unrecorded V4 run with the structured-result contract", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ id: "run-1", status: "queued" }),
    );
    const runner = new BrowserUseJourneyRunner({
      apiKey: "test-key",
      fetch: fetcher,
    });

    await expect(runner.createRun("Browse the demo naturally.")).resolves.toEqual({
      runId: "run-1",
      status: "queued",
      cursor: 0,
    });

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("https://api.browser-use.com/api/v4/runs");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "grok-4.5",
      browserSettings: { proxyCountryCode: "us", record: false },
    });
    expect(String(body.task)).toContain('"shareLikelihood":0');
    expect(new Headers(init?.headers).get("X-Browser-Use-API-Key")).toBe(
      "test-key",
    );
  });

  it("surfaces browser.ready and validates the completed structured output", async () => {
    const liveViewUrl = "https://live.browser-use.com/?credential=secret";
    const output = {
      outcome: "Left after reviewing security.",
      pagesVisited: ["/security"],
      converted: false,
      frictions: ["Early bank access"],
      positiveSignals: ["Clear security controls"],
      trustDelta: 0.18,
      intentDelta: 0.05,
      shareLikelihood: 0.7,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          events: [
            {
              id: 3,
              type: "browser.ready",
              data: { live_view_url: liveViewUrl },
            },
          ],
          nextAfter: 3,
          hasMore: false,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ status: "completed" }))
      .mockResolvedValueOnce(
        jsonResponse({ status: "completed", result: JSON.stringify(output) }),
      );
    const runner = new BrowserUseJourneyRunner({
      apiKey: "test-key",
      fetch: fetcher,
    });

    await expect(
      runner.pollRun({ runId: "run-1", status: "running", cursor: 0 }),
    ).resolves.toEqual({
      runId: "run-1",
      status: "completed",
      cursor: 3,
      terminal: true,
      liveViewUrl,
      output,
    });
  });

  it("polls through running state and emits the live credential once", async () => {
    const liveViewUrl = "https://live.browser-use.com/?credential=secret";
    const output = {
      outcome: "Reviewed the product and left.",
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
      .mockResolvedValueOnce(
        jsonResponse({
          events: [
            {
              id: 1,
              type: "browser.ready",
              data: { live_view_url: liveViewUrl },
            },
          ],
          nextAfter: 1,
          hasMore: false,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ status: "running" }))
      .mockResolvedValueOnce(
        jsonResponse({ events: [], nextAfter: 1, hasMore: false }),
      )
      .mockResolvedValueOnce(jsonResponse({ status: "completed" }))
      .mockResolvedValueOnce(
        jsonResponse({ status: "completed", result: JSON.stringify(output) }),
      );
    const onBrowserReady = vi.fn();
    const runner = new BrowserUseJourneyRunner({
      apiKey: "test-key",
      fetch: fetcher,
    });

    const completed = await runner.waitForCompletion(
      { runId: "run-1", status: "queued", cursor: 0 },
      { pollIntervalMs: 0, onBrowserReady },
    );

    expect(onBrowserReady).toHaveBeenCalledOnce();
    expect(onBrowserReady).toHaveBeenCalledWith(liveViewUrl);
    expect(completed).toEqual({ runId: "run-1", liveViewUrl, output });
    expect(fetcher.mock.calls[2]?.[0]).toContain("after=1");
  });

  it("never includes an API response body in HTTP errors", async () => {
    const credential = "https://live.browser-use.com/?credential=do-not-leak";
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ live_view_url: credential }, 500));
    const runner = new BrowserUseJourneyRunner({
      apiKey: "test-key",
      fetch: fetcher,
    });

    await expect(runner.createRun("Browse safely")).rejects.toThrow(
      "Browser Use request failed with HTTP 500.",
    );
    await expect(runner.createRun("Browse safely")).rejects.not.toThrow(
      credential,
    );
  });
});
