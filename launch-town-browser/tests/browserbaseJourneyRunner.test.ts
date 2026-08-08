import { describe, expect, it, vi } from "vitest";
import {
  BrowserbaseStagehandJourneyRunner,
  type BrowserbaseClient,
  type StagehandDriver,
} from "../src/browserbaseJourneyRunner.js";

const output = {
  outcome: "Reviewed the public page and left.",
  pagesVisited: ["https://maya.example"],
  converted: false,
  frictions: [],
  positiveSignals: ["The purpose was clear"],
  trustDelta: 0.04,
  intentDelta: 0,
  shareLikelihood: 0.2,
};

function client(sessionIds = ["session-1"], statuses = ["RUNNING", "COMPLETED"]): BrowserbaseClient {
  let index = 0;
  let statusIndex = 0;
  return {
    sessions: {
      create: vi.fn(async () => ({ id: sessionIds[index++]! })),
      retrieve: vi.fn(async () => ({
        status: statuses[Math.min(statusIndex++, statuses.length - 1)]!,
      })),
      update: vi.fn(async () => ({})),
    },
  };
}

const context = (personaKey: string) => ({
  simulationRunId: "run-123",
  productId: "product-456",
  productUrl: "https://maya.example/research",
  personaKey,
});

describe("BrowserbaseStagehandJourneyRunner", () => {
  it("creates one SDK session per persona with safe metadata and locked domains", async () => {
    const browserbaseClient = client(["session-priya", "session-rohan"]);
    const runner = new BrowserbaseStagehandJourneyRunner({
      browserbaseApiKey: "bb-key",
      browserbaseProjectId: "project-1",
      anthropicApiKey: "anthropic-key",
      approvedVerificationDomains: ["status.maya.example"],
      browserbaseClient,
    });

    const priya = await runner.createRun("Browse naturally.", context("priya"));
    const rohan = await runner.createRun("Browse naturally.", context("rohan"));

    expect(priya.sessionId).toBe("session-priya");
    expect(rohan.sessionId).toBe("session-rohan");
    expect(priya.sessionId).not.toBe(rohan.sessionId);
    expect(browserbaseClient.sessions.create).toHaveBeenNthCalledWith(1, {
      projectId: "project-1",
      timeout: 300,
      keepAlive: false,
      proxies: false,
      userMetadata: { run: "run-123", product: "product-456", persona: "priya" },
      browserSettings: {
        allowedDomains: ["maya.example", "status.maya.example"],
        recordSession: false,
        logSession: false,
      },
    });
    expect(JSON.stringify(priya)).not.toContain("connectUrl");
    expect(JSON.stringify(priya)).not.toContain("debug");
  });

  it("drives Stagehand, retrieves status, and requests release", async () => {
    const browserbaseClient = client();
    const driver: StagehandDriver = {
      init: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(output),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const factory = vi.fn(() => driver);
    const runner = new BrowserbaseStagehandJourneyRunner({
      browserbaseApiKey: "bb-key",
      browserbaseProjectId: "project-1",
      anthropicApiKey: "anthropic-key",
      browserbaseClient,
      stagehandDriverFactory: factory,
    });
    const handle = await runner.createRun("Browse naturally.", context("priya"));

    await expect(runner.waitForCompletion(handle)).resolves.toEqual({
      runId: "session-1",
      sessionStatus: "COMPLETED",
      output,
    });
    expect(driver.close).toHaveBeenCalledOnce();
    expect(browserbaseClient.sessions.retrieve).toHaveBeenCalledTimes(2);
    expect(browserbaseClient.sessions.update).toHaveBeenCalledWith("session-1", {
      status: "REQUEST_RELEASE",
      projectId: "project-1",
    });
  });

  it("does not create a replacement session when a persona journey fails", async () => {
    const browserbaseClient = client();
    const driver: StagehandDriver = {
      init: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockRejectedValue(new Error("journey failed")),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const runner = new BrowserbaseStagehandJourneyRunner({
      browserbaseApiKey: "bb-key",
      browserbaseProjectId: "project-1",
      anthropicApiKey: "anthropic-key",
      browserbaseClient,
      stagehandDriverFactory: () => driver,
    });
    const handle = await runner.createRun("Browse naturally.", context("priya"));

    await expect(runner.waitForCompletion(handle)).rejects.toThrow("journey failed");
    expect(browserbaseClient.sessions.create).toHaveBeenCalledOnce();
    expect(browserbaseClient.sessions.update).toHaveBeenCalledOnce();
  });

  it("rejects a session timeout above the plan cap", () => {
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
