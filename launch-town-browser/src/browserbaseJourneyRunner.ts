import { Stagehand } from "@browserbasehq/stagehand";
import { combineAbortSignals } from "./abortSignals.js";
import {
  type BrowserJourneyRunner,
  type BrowserRunHandle,
  type BrowserRunUpdate,
  type CompletedBrowserJourney,
  type WaitForCompletionOptions,
} from "./browserJourneyRunner.js";
import {
  BrowserJourneyOutputSchema,
  type BrowserJourneyOutput,
} from "./schemas.js";

export interface BrowserbaseStagehandRunnerOptions {
  browserbaseApiKey?: string;
  browserbaseProjectId?: string;
  anthropicApiKey?: string;
  model?: string;
  maxSteps?: number;
  sessionTimeoutSeconds?: number;
  executionTimeoutMs?: number;
  baseUrl?: string;
  fetch?: typeof fetch;
  stagehandDriverFactory?: StagehandDriverFactory;
}

export interface StagehandDriverConfig {
  browserbaseApiKey: string;
  browserbaseProjectId: string;
  browserbaseSessionId: string;
  anthropicApiKey: string;
  model: string;
  maxSteps: number;
}

export interface StagehandDriver {
  init(): Promise<void>;
  execute(taskPrompt: string, signal: AbortSignal): Promise<unknown>;
  close(): Promise<void>;
}

export type StagehandDriverFactory = (
  config: StagehandDriverConfig,
) => StagehandDriver;

const DEFAULT_BASE_URL = "https://api.browserbase.com/v1";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";
const DEFAULT_SESSION_TIMEOUT_SECONDS = 300;
const MAX_SESSION_TIMEOUT_SECONDS = 900;
const DEFAULT_EXECUTION_TIMEOUT_MS = 4 * 60 * 1_000;

/** Browserbase session + direct-Anthropic Stagehand implementation. */
export class BrowserbaseStagehandJourneyRunner
  implements BrowserJourneyRunner
{
  private readonly browserbaseApiKey: string;
  private readonly browserbaseProjectId: string;
  private readonly anthropicApiKey: string;
  private readonly model: string;
  private readonly maxSteps: number;
  private readonly sessionTimeoutSeconds: number;
  private readonly executionTimeoutMs: number;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly stagehandDriverFactory: StagehandDriverFactory;

  constructor(options: BrowserbaseStagehandRunnerOptions = {}) {
    const browserbaseApiKey =
      options.browserbaseApiKey ?? process.env.BROWSERBASE_API_KEY;
    const browserbaseProjectId =
      options.browserbaseProjectId ?? process.env.BROWSERBASE_PROJECT_ID;
    const anthropicApiKey =
      options.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;

    if (!browserbaseApiKey) throw new Error("BROWSERBASE_API_KEY is required.");
    if (!browserbaseProjectId) {
      throw new Error("BROWSERBASE_PROJECT_ID is required.");
    }
    if (!anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is required.");

    const sessionTimeoutSeconds =
      options.sessionTimeoutSeconds ?? DEFAULT_SESSION_TIMEOUT_SECONDS;
    if (
      sessionTimeoutSeconds <= 0 ||
      sessionTimeoutSeconds > MAX_SESSION_TIMEOUT_SECONDS
    ) {
      throw new Error("Browserbase session timeout must be between 1 and 900 seconds.");
    }

    this.browserbaseApiKey = browserbaseApiKey;
    this.browserbaseProjectId = browserbaseProjectId;
    this.anthropicApiKey = anthropicApiKey;
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxSteps = options.maxSteps ?? 20;
    this.sessionTimeoutSeconds = sessionTimeoutSeconds;
    this.executionTimeoutMs =
      options.executionTimeoutMs ?? DEFAULT_EXECUTION_TIMEOUT_MS;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.stagehandDriverFactory =
      options.stagehandDriverFactory ?? createDefaultStagehandDriver;
  }

  async createRun(taskPrompt: string): Promise<BrowserRunHandle> {
    if (!taskPrompt.trim()) throw new Error("A browser task prompt is required.");

    const session = asRecord(
      await this.request("/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId: this.browserbaseProjectId,
          timeout: this.sessionTimeoutSeconds,
          keepAlive: false,
          proxies: false,
          browserSettings: {
            recordSession: false,
            logSession: false,
          },
        }),
      }),
      "create-session response",
    );
    const sessionId = requireString(session.id, "Browserbase session id");

    try {
      const live = asRecord(
        await this.request(`/sessions/${encodeURIComponent(sessionId)}/debug`),
        "session-live response",
      );
      const liveViewUrl = requireSecureUrl(
        live.debuggerFullscreenUrl,
        "Browserbase live view URL",
      );

      return {
        runId: sessionId,
        sessionId,
        status: "running",
        cursor: 0,
        liveViewUrl,
        taskPrompt: taskPrompt.trim(),
      };
    } catch (error) {
      await this.releaseSession(sessionId);
      throw error;
    }
  }

  async pollRun(
    run: BrowserRunHandle,
    signal?: AbortSignal,
  ): Promise<BrowserRunUpdate> {
    const sessionId = run.sessionId ?? run.runId;
    if (!run.taskPrompt) {
      throw new BrowserbaseJourneyError(
        "Browserbase run handle is missing its task prompt.",
      );
    }

    const timeoutSignal = AbortSignal.timeout(this.executionTimeoutMs);
    const executionSignal = signal
      ? combineAbortSignals(signal, timeoutSignal)
      : timeoutSignal;
    let driver: StagehandDriver | undefined;

    try {
      driver = this.stagehandDriverFactory({
        browserbaseApiKey: this.browserbaseApiKey,
        browserbaseProjectId: this.browserbaseProjectId,
        browserbaseSessionId: sessionId,
        anthropicApiKey: this.anthropicApiKey,
        model: this.model,
        maxSteps: this.maxSteps,
      });
      await driver.init();
      const output = parseOutput(
        await driver.execute(run.taskPrompt, executionSignal),
      );
      return {
        ...run,
        status: "completed",
        terminal: true,
        output,
      };
    } finally {
      await Promise.allSettled([
        driver?.close() ?? Promise.resolve(),
        this.releaseSession(sessionId),
      ]);
    }
  }

  async waitForCompletion(
    run: BrowserRunHandle,
    options: WaitForCompletionOptions = {},
  ): Promise<CompletedBrowserJourney> {
    if (run.liveViewUrl) {
      await options.onBrowserReady?.(run.liveViewUrl);
    }

    const timeoutMs = Math.min(
      options.timeoutMs ?? this.executionTimeoutMs,
      this.executionTimeoutMs,
    );
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = options.signal
      ? combineAbortSignals(options.signal, timeoutSignal)
      : timeoutSignal;
    const update = await this.pollRun(run, signal);
    if (!update.output) {
      throw new BrowserbaseJourneyError(
        update.error ?? "Browserbase journey returned no output.",
      );
    }
    return {
      runId: update.runId,
      ...(run.liveViewUrl ? { liveViewUrl: run.liveViewUrl } : {}),
      output: update.output,
    };
  }

  private async releaseSession(sessionId: string): Promise<void> {
    try {
      await this.request(`/sessions/${encodeURIComponent(sessionId)}`, {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          status: "REQUEST_RELEASE",
          projectId: this.browserbaseProjectId,
        }),
      });
    } catch {
      // Stagehand close also disconnects non-keepalive sessions. This second
      // release path is best-effort so cleanup cannot mask the journey result.
    }
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-BB-API-Key": this.browserbaseApiKey,
      },
    });
    if (!response.ok) {
      throw new BrowserbaseJourneyError(
        `Browserbase request failed with HTTP ${response.status}.`,
        response.status,
      );
    }
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new BrowserbaseJourneyError("Browserbase returned a non-JSON response.");
    }
  }
}

export class BrowserbaseJourneyError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "BrowserbaseJourneyError";
  }
}

function createDefaultStagehandDriver(
  config: StagehandDriverConfig,
): StagehandDriver {
  const model = {
    modelName: config.model,
    apiKey: config.anthropicApiKey,
  };
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: config.browserbaseApiKey,
    projectId: config.browserbaseProjectId,
    browserbaseSessionID: config.browserbaseSessionId,
    keepAlive: false,
    model,
    experimental: true,
    verbose: 0,
    disablePino: true,
    logger: () => {},
  });

  return {
    init: () => stagehand.init(),
    execute: async (taskPrompt, signal) => {
      const agent = stagehand.agent({
        mode: "dom",
        model,
        executionModel: model,
        systemPrompt:
          "Browse naturally as the resident described by the task. Never make real purchases or consequential transactions. End as soon as the resident would naturally stop, and ground the final structured result only in pages actually visited.",
      });
      const result = await agent.execute({
        instruction: taskPrompt,
        maxSteps: config.maxSteps,
        output: BrowserJourneyOutputSchema,
        signal,
        excludeTools: ["search"],
      });
      return result.output;
    },
    close: () => stagehand.close({ force: true }),
  };
}

function parseOutput(value: unknown): BrowserJourneyOutput {
  const parsed = BrowserJourneyOutputSchema.safeParse(value);
  if (!parsed.success) {
    throw new BrowserbaseJourneyError(
      "Stagehand did not return the journey output contract.",
    );
  }
  return parsed.data;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BrowserbaseJourneyError(`Invalid ${label}.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) {
    throw new BrowserbaseJourneyError(`Invalid ${label}.`);
  }
  return value;
}

function requireSecureUrl(value: unknown, label: string): string {
  const url = requireString(value, label);
  try {
    if (new URL(url).protocol !== "https:") throw new Error();
  } catch {
    throw new BrowserbaseJourneyError(`Invalid ${label}.`);
  }
  return url;
}
