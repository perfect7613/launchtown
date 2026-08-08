import { describe, expect, it, vi } from "vitest";
import {
  BrowserbaseStagehandJourneyRunner,
  type StagehandDriver,
} from "../src/browserbaseJourneyRunner.js";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const output = {
  outcome: "Reviewed the public page and left.",
  pagesVisited: ["https://example.com"],
  converted: false,
  frictions: [],
  positiveSignals: ["The purpose was clear"],
  trustDelta: 0.04,
  intentDelta: 0,
  shareLikelihood: 0.2,
};

describe("BrowserbaseStagehandJourneyRunner", () => {
  it("creates an unrecorded five-minute session and returns its live view", async () => {
    const liveViewUrl = "https://www.browserbase.com/live?credential=secret";
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ id: "session-1" }, 201))
      .mockResolvedValueOnce(
        jsonResponse({ debuggerFullscreenUrl: liveViewUrl }),
      );
    const runner = new BrowserbaseStagehandJourneyRunner({
      browserbaseApiKey: "bb-key",
      browserbaseProjectId: "project-1",
      anthropicApiKey: "anthropic-key",
      fetch: fetcher,
    });

    await expect(runner.createRun("Browse naturally.")).resolves.toEqual({
      runId: "session-1",
      sessionId: "session-1",
      status: "running",
      cursor: 0,
      liveViewUrl,
      taskPrompt: "Browse naturally.",
    });

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("https://api.browserbase.com/v1/sessions");
    expect(JSON.parse(String(init?.body))).toEqual({
      projectId: "project-1",
      timeout: 300,
      keepAlive: false,
      proxies: false,
      browserSettings: { recordSession: false, logSession: false },
    });
  });

  it("drives Stagehand with direct Claude output and releases promptly", async () => {
    const liveViewUrl = "https://www.browserbase.com/live?credential=secret";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}));
    const driver: StagehandDriver = {
      init: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(output),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const factory = vi.fn(() => driver);
    const onBrowserReady = vi.fn();
    const runner = new BrowserbaseStagehandJourneyRunner({
      browserbaseApiKey: "bb-key",
      browserbaseProjectId: "project-1",
      anthropicApiKey: "anthropic-key",
      fetch: fetcher,
      stagehandDriverFactory: factory,
    });
    const handle = {
      runId: "session-1",
      sessionId: "session-1",
      status: "running" as const,
      cursor: 0,
      liveViewUrl,
      taskPrompt: "Browse naturally.",
    };

    await expect(
      runner.waitForCompletion(handle, { onBrowserReady }),
    ).resolves.toEqual({ runId: "session-1", liveViewUrl, output });

    expect(onBrowserReady).toHaveBeenCalledWith(liveViewUrl);
    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({
        browserbaseSessionId: "session-1",
        browserbaseApiKey: "bb-key",
        browserbaseProjectId: "project-1",
        anthropicApiKey: "anthropic-key",
        model: "anthropic/claude-sonnet-4-6",
      }),
    );
    expect(driver.init).toHaveBeenCalledOnce();
    expect(driver.execute).toHaveBeenCalledWith(
      "Browse naturally.",
      expect.any(AbortSignal),
    );
    expect(driver.close).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.browserbase.com/v1/sessions/session-1",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects a session timeout above the free-plan cap", () => {
    expect(
      () =>
        new BrowserbaseStagehandJourneyRunner({
          browserbaseApiKey: "bb-key",
          browserbaseProjectId: "project-1",
          anthropicApiKey: "anthropic-key",
          sessionTimeoutSeconds: 901,
        }),
    ).toThrow("between 1 and 900 seconds");
  });
});
