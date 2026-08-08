import { Stagehand } from "@browserbasehq/stagehand";
import Browserbase from "@browserbasehq/sdk";
import { combineAbortSignals } from "./abortSignals.js";
import {
  type BrowserJourneyRunner,
  type BrowserRunHandle,
  type BrowserRunContext,
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
  approvedVerificationDomains?: string[];
  browserbaseClient?: BrowserbaseClient;
  stagehandDriverFactory?: StagehandDriverFactory;
}

export interface BrowserbaseClient {
  sessions: {
    create(params: Record<string, unknown>): Promise<{ id: string }>;
    retrieve(id: string): Promise<{ status: string }>;
    update(id: string, params: { status: "REQUEST_RELEASE"; projectId?: string }): Promise<unknown>;
  };
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
  private readonly approvedVerificationDomains: string[];
  private readonly browserbaseClient: BrowserbaseClient;
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
    this.approvedVerificationDomains = normalizeDomains(
      options.approvedVerificationDomains ??
        (process.env.BROWSERBASE_VERIFICATION_DOMAINS ?? "")
          .split(",")
          .filter(Boolean),
    );
    this.browserbaseClient =
      options.browserbaseClient ??
      (new Browserbase({ apiKey: this.browserbaseApiKey }) as BrowserbaseClient);
    this.stagehandDriverFactory =
      options.stagehandDriverFactory ?? createDefaultStagehandDriver;
  }

  async createRun(taskPrompt: string, context?: BrowserRunContext): Promise<BrowserRunHandle> {
    if (!taskPrompt.trim()) throw new Error("A browser task prompt is required.");
    if (!context) throw new Error("Browserbase run context is required.");

    const productDomain = domainFromUrl(context.productUrl);
    const allowedDomains = normalizeDomains([
      productDomain,
      ...this.approvedVerificationDomains,
    ]);

    const session = await this.browserbaseClient.sessions.create({
      projectId: this.browserbaseProjectId,
      timeout: this.sessionTimeoutSeconds,
      keepAlive: false,
      proxies: false,
      userMetadata: safeMetadata(context),
      browserSettings: {
        allowedDomains,
        recordSession: false,
        logSession: false,
      },
    });
    const sessionId = requireString(session.id, "Browserbase session id");
    const retrieved = await this.browserbaseClient.sessions.retrieve(sessionId);

    return {
      runId: sessionId,
      sessionId,
      status: "running",
      cursor: 0,
      sessionStatus: requireSessionStatus(retrieved.status),
      taskPrompt: taskPrompt.trim(),
    };
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

    let output: BrowserJourneyOutput;
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
      output = parseOutput(
        await driver.execute(run.taskPrompt, executionSignal),
      );
    } finally {
      await Promise.allSettled([
        driver?.close() ?? Promise.resolve(),
        this.releaseSession(sessionId),
      ]);
    }
    const sessionStatus = await this.retrieveFinalSessionStatus(sessionId);
    return {
      ...run,
      status: "completed",
      terminal: true,
      sessionStatus,
      output,
    };
  }

  async waitForCompletion(
    run: BrowserRunHandle,
    options: WaitForCompletionOptions = {},
  ): Promise<CompletedBrowserJourney> {
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
      ...(update.sessionStatus ? { sessionStatus: update.sessionStatus } : {}),
      output: update.output,
    };
  }

  private async releaseSession(sessionId: string): Promise<void> {
    try {
      await this.browserbaseClient.sessions.update(sessionId, {
        status: "REQUEST_RELEASE",
        projectId: this.browserbaseProjectId,
      });
    } catch {
      // Stagehand close also disconnects non-keepalive sessions. This second
      // release path is best-effort so cleanup cannot mask the journey result.
    }
  }

  private async retrieveFinalSessionStatus(sessionId: string) {
    let status: ReturnType<typeof requireSessionStatus> = "RUNNING";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const retrieved = await this.browserbaseClient.sessions.retrieve(sessionId);
      status = requireSessionStatus(retrieved.status);
      if (status !== "PENDING" && status !== "RUNNING") return status;
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      }
    }
    return status;
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

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) {
    throw new BrowserbaseJourneyError(`Invalid ${label}.`);
  }
  return value;
}

function domainFromUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BrowserbaseJourneyError("Product URL must use HTTP or HTTPS.");
  }
  return url.hostname.toLowerCase();
}

function normalizeDomains(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter((value) =>
    /^[a-z0-9.-]+$/.test(value) && value.includes(".")
  ))].sort();
}

function safeMetadata(context: BrowserRunContext): Record<string, string> {
  const safe = (value: string) => value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 128);
  return {
    run: safe(context.simulationRunId),
    product: safe(context.productId),
    persona: safe(context.personaKey),
  };
}

function requireSessionStatus(value: string) {
  if (
    value === "PENDING" || value === "RUNNING" || value === "ERROR" ||
    value === "TIMED_OUT" || value === "COMPLETED"
  ) return value;
  throw new BrowserbaseJourneyError("Browserbase returned an invalid session status.");
}
