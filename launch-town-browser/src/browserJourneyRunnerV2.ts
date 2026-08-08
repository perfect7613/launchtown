import {
  BROWSER_JOURNEY_STRUCTURED_OUTPUT_INSTRUCTION,
  BrowserUseError,
  type BrowserJourneyRunner,
  type BrowserRunHandle,
  type BrowserRunStatus,
  type BrowserRunUpdate,
  type BrowserUseJourneyRunnerOptions,
  type CompletedBrowserJourney,
  type WaitForCompletionOptions,
} from "./browserJourneyRunner.js";
import {
  BrowserJourneyOutputSchema,
  type BrowserJourneyOutput,
} from "./schemas.js";
import { combineAbortSignals } from "./abortSignals.js";

export interface BrowserUseV2JourneyRunnerOptions
  extends Omit<BrowserUseJourneyRunnerOptions, "model"> {
  model?: string;
  maxSteps?: number;
}

const DEFAULT_BASE_URL = "https://api.browser-use.com/api/v2";
const DEFAULT_MODEL = "browser-use-2.0";

const V2_OUTPUT_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    outcome: { type: "string" },
    pagesVisited: { type: "array", items: { type: "string" } },
    converted: { type: "boolean" },
    frictions: { type: "array", items: { type: "string" } },
    positiveSignals: { type: "array", items: { type: "string" } },
    trustDelta: { type: "number", minimum: -1, maximum: 1 },
    intentDelta: { type: "number", minimum: -1, maximum: 1 },
    shareLikelihood: { type: "number", minimum: 0, maximum: 1 },
  },
  required: [
    "outcome",
    "pagesVisited",
    "converted",
    "frictions",
    "positiveSignals",
    "trustDelta",
    "intentDelta",
    "shareLikelihood",
  ],
  additionalProperties: false,
});

/** Free-tier-compatible Browser Use V2 adapter behind the common journey interface. */
export class BrowserUseV2JourneyRunner implements BrowserJourneyRunner {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly maxSteps: number;
  private readonly fetcher: typeof fetch;

  constructor(options: BrowserUseV2JourneyRunnerOptions = {}) {
    const apiKey = options.apiKey ?? process.env.BROWSER_USE_API_KEY;
    if (!apiKey) throw new Error("BROWSER_USE_API_KEY is required.");

    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxSteps = options.maxSteps ?? 20;
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  async createRun(taskPrompt: string): Promise<BrowserRunHandle> {
    if (!taskPrompt.trim()) throw new Error("A browser task prompt is required.");

    const body = asRecord(
      await this.request("/tasks", {
        method: "POST",
        body: JSON.stringify({
          task: `${taskPrompt.trim()}\n\n${BROWSER_JOURNEY_STRUCTURED_OUTPUT_INSTRUCTION}`,
          llm: this.model,
          maxSteps: this.maxSteps,
          structuredOutput: V2_OUTPUT_SCHEMA,
          sessionSettings: {
            proxyCountryCode: "us",
            enableRecording: false,
          },
          thinking: false,
          judge: false,
        }),
      }),
      "create-task response",
    );

    return {
      runId: requireString(body.id, "create-task id"),
      sessionId: requireString(body.sessionId, "create-task session id"),
      status: "queued",
      cursor: 0,
    };
  }

  async pollRun(
    run: BrowserRunHandle,
    signal?: AbortSignal,
  ): Promise<BrowserRunUpdate> {
    const sessionId = run.sessionId;
    if (!sessionId) {
      throw new BrowserUseError("V2 run handle is missing its session id.");
    }

    const session = asRecord(
      await this.request(
        `/sessions/${encodeURIComponent(sessionId)}`,
        signal ? { signal } : {},
      ),
      "session response",
    );
    const liveViewUrl =
      typeof session.liveUrl === "string" && isSecureUrl(session.liveUrl)
        ? session.liveUrl
        : undefined;

    const task = asRecord(
      await this.request(
        `/tasks/${encodeURIComponent(run.runId)}/status`,
        signal ? { signal } : {},
      ),
      "task-status response",
    );
    const status = mapV2Status(task.status);
    const terminal =
      status === "completed" || status === "failed" || status === "cancelled";

    if (!terminal) {
      return {
        ...run,
        status,
        terminal: false,
        ...(liveViewUrl ? { liveViewUrl } : {}),
      };
    }

    if (status !== "completed") {
      return {
        ...run,
        status,
        terminal: true,
        ...(liveViewUrl ? { liveViewUrl } : {}),
        error: `Browser run ${status}.`,
      };
    }

    const output = parseOutput(task.output);
    return {
      ...run,
      status,
      terminal: true,
      ...(liveViewUrl ? { liveViewUrl } : {}),
      output,
    };
  }

  async waitForCompletion(
    initialRun: BrowserRunHandle,
    options: WaitForCompletionOptions = {},
  ): Promise<CompletedBrowserJourney> {
    const pollIntervalMs = options.pollIntervalMs ?? 1_000;
    const timeoutMs = options.timeoutMs ?? 15 * 60 * 1_000;
    const startedAt = Date.now();
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = options.signal
      ? combineAbortSignals(options.signal, timeoutSignal)
      : timeoutSignal;
    let liveViewUrl: string | undefined;
    let run = initialRun;

    while (true) {
      throwIfAborted(signal);
      const update = await this.pollRun(run, signal);
      if (update.liveViewUrl && update.liveViewUrl !== liveViewUrl) {
        liveViewUrl = update.liveViewUrl;
        await options.onBrowserReady?.(liveViewUrl);
      }

      if (update.terminal) {
        if (update.status !== "completed" || !update.output) {
          throw new BrowserUseError(update.error ?? `Browser run ${update.status}.`);
        }
        return {
          runId: update.runId,
          ...(liveViewUrl ? { liveViewUrl } : {}),
          output: update.output,
        };
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new BrowserUseError("Timed out waiting for browser run completion.");
      }
      run = update;
      await delay(pollIntervalMs, signal);
    }
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Browser-Use-API-Key": this.apiKey,
      },
    });

    if (!response.ok) {
      throw new BrowserUseError(
        `Browser Use V2 request failed with HTTP ${response.status}.`,
        response.status,
      );
    }
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new BrowserUseError("Browser Use V2 returned a non-JSON response.");
    }
  }
}

function parseOutput(value: unknown): BrowserJourneyOutput {
  if (typeof value !== "string") {
    throw new BrowserUseError("Completed V2 browser run returned no output.");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(value) as unknown;
  } catch {
    throw new BrowserUseError("Completed V2 browser run returned invalid JSON.");
  }
  const parsed = BrowserJourneyOutputSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new BrowserUseError(
      "Completed V2 browser run did not match the journey output contract.",
    );
  }
  return parsed.data;
}

function mapV2Status(value: unknown): BrowserRunStatus {
  if (value === "created") return "queued";
  if (value === "started") return "running";
  if (value === "finished") return "completed";
  if (value === "failed") return "failed";
  if (value === "stopped") return "cancelled";
  throw new BrowserUseError("Invalid V2 browser task status.");
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BrowserUseError(`Invalid ${label}.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) {
    throw new BrowserUseError(`Invalid ${label}.`);
  }
  return value;
}

function isSecureUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException("The operation was aborted.", "AbortError");
  }
}

async function delay(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    if (!signal) return;
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new DOMException("The operation was aborted.", "AbortError"),
        );
      },
      { once: true },
    );
  });
}
