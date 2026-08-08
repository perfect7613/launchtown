import {
  BrowserJourneyOutputSchema,
  type BrowserJourneyOutput,
} from "./schemas.js";
import { combineAbortSignals } from "./abortSignals.js";

export type BrowserRunStatus =
  | "queued"
  | "dispatching"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface BrowserRunHandle {
  runId: string;
  status: BrowserRunStatus;
  cursor: number;
  sessionId?: string;
  liveViewUrl?: string;
  taskPrompt?: string;
}

export interface BrowserRunUpdate extends BrowserRunHandle {
  terminal: boolean;
  liveViewUrl?: string;
  output?: BrowserJourneyOutput;
  error?: string;
}

export interface CompletedBrowserJourney {
  runId: string;
  liveViewUrl?: string;
  output: BrowserJourneyOutput;
}

export interface WaitForCompletionOptions {
  cursor?: number;
  pollIntervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onBrowserReady?: (liveViewUrl: string) => void | Promise<void>;
}

export interface BrowserJourneyRunner {
  createRun(taskPrompt: string): Promise<BrowserRunHandle>;
  pollRun(
    run: BrowserRunHandle,
    signal?: AbortSignal,
  ): Promise<BrowserRunUpdate>;
  waitForCompletion(
    run: BrowserRunHandle,
    options?: WaitForCompletionOptions,
  ): Promise<CompletedBrowserJourney>;
}

export interface BrowserUseJourneyRunnerOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetch?: typeof fetch;
}

interface RunEvent {
  id: number;
  type: string;
  data: Record<string, unknown>;
}

const DEFAULT_BASE_URL = "https://api.browser-use.com/api/v4";
const DEFAULT_MODEL = "grok-4.5";
const MAX_EVENT_PAGES = 50;
const TERMINAL_STATUSES: readonly BrowserRunStatus[] = [
  "completed",
  "failed",
  "cancelled",
];

export const BROWSER_JOURNEY_STRUCTURED_OUTPUT_INSTRUCTION = `When you stop, return only one JSON object with exactly these fields and no markdown: {"outcome":"brief summary","pagesVisited":["URL or path"],"converted":false,"frictions":["observed friction"],"positiveSignals":["observed positive signal"],"trustDelta":0,"intentDelta":0,"shareLikelihood":0}. trustDelta and intentDelta must be numbers from -1 to 1. shareLikelihood must be a number from 0 to 1.`;

export class BrowserUseJourneyRunner implements BrowserJourneyRunner {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetcher: typeof fetch;

  constructor(options: BrowserUseJourneyRunnerOptions = {}) {
    const apiKey = options.apiKey ?? process.env.BROWSER_USE_API_KEY;
    if (!apiKey) {
      throw new Error("BROWSER_USE_API_KEY is required.");
    }
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.model = options.model ?? DEFAULT_MODEL;
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  async createRun(taskPrompt: string): Promise<BrowserRunHandle> {
    if (!taskPrompt.trim())
      throw new Error("A browser task prompt is required.");

    const body = await this.request("/runs", {
      method: "POST",
      body: JSON.stringify({
        task: `${taskPrompt.trim()}\n\n${BROWSER_JOURNEY_STRUCTURED_OUTPUT_INSTRUCTION}`,
        model: this.model,
        browserSettings: {
          proxyCountryCode: "us",
          record: false,
        },
      }),
    });

    const record = asRecord(body, "create-run response");
    return {
      runId: requireString(record.id, "create-run id"),
      status: requireStatus(record.status),
      cursor: 0,
    };
  }

  async pollRun(
    run: BrowserRunHandle,
    signal?: AbortSignal,
  ): Promise<BrowserRunUpdate> {
    let cursor = run.cursor;
    let liveViewUrl: string | undefined;
    let hasMore = true;
    let pages = 0;

    while (hasMore) {
      if (pages++ >= MAX_EVENT_PAGES) {
        throw new BrowserUseError("Too many browser run event pages.");
      }
      const cursorBefore = cursor;
      const page = asRecord(
        await this.request(
          `/runs/${encodeURIComponent(run.runId)}/events?after=${cursor}&limit=200`,
          signal ? { signal } : {},
        ),
        "run-events response",
      );
      const events = requireEvents(page.events);
      for (const event of events) {
        cursor = Math.max(cursor, event.id);
        if (event.type === "browser.ready") {
          const candidate = event.data.live_view_url;
          if (typeof candidate === "string" && isSecureUrl(candidate)) {
            liveViewUrl = candidate;
          }
        }
      }

      if (typeof page.nextAfter === "number") {
        cursor = Math.max(cursor, page.nextAfter);
      }
      hasMore = page.hasMore === true;
      if (hasMore && cursor <= cursorBefore) {
        throw new BrowserUseError("Browser run event cursor did not advance.");
      }
    }

    const statusPayload = asRecord(
      await this.request(
        `/runs/${encodeURIComponent(run.runId)}/status`,
        signal ? { signal } : {},
      ),
      "run-status response",
    );
    const status = requireStatus(statusPayload.status);
    const terminal = TERMINAL_STATUSES.includes(status);

    if (!terminal) {
      return {
        runId: run.runId,
        status,
        cursor,
        terminal: false,
        ...(liveViewUrl ? { liveViewUrl } : {}),
      };
    }

    const summary = asRecord(
      await this.request(
        `/runs/${encodeURIComponent(run.runId)}`,
        signal ? { signal } : {},
      ),
      "run-summary response",
    );

    if (status !== "completed") {
      return {
        runId: run.runId,
        status,
        cursor,
        terminal: true,
        ...(liveViewUrl ? { liveViewUrl } : {}),
        ...(typeof summary.error === "string"
          ? { error: summary.error }
          : { error: `Browser run ${status}.` }),
      };
    }

    const result = requireString(summary.result, "completed run result");
    let decoded: unknown;
    try {
      decoded = JSON.parse(result) as unknown;
    } catch {
      throw new BrowserUseError("Completed browser run returned invalid JSON.");
    }

    const parsed = BrowserJourneyOutputSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new BrowserUseError(
        "Completed browser run did not match the journey output contract.",
      );
    }

    return {
      runId: run.runId,
      status,
      cursor,
      terminal: true,
      ...(liveViewUrl ? { liveViewUrl } : {}),
      output: parsed.data,
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
    let run = { ...initialRun, cursor: options.cursor ?? initialRun.cursor };

    while (true) {
      throwIfAborted(signal);
      const update = await this.pollRun(run, signal);
      if (update.liveViewUrl && update.liveViewUrl !== liveViewUrl) {
        liveViewUrl = update.liveViewUrl;
        await options.onBrowserReady?.(liveViewUrl);
      }

      if (update.terminal) {
        if (update.status !== "completed" || !update.output) {
          throw new BrowserUseError(
            update.error ?? `Browser run ${update.status}.`,
          );
        }
        return {
          runId: update.runId,
          ...(liveViewUrl ? { liveViewUrl } : {}),
          output: update.output,
        };
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new BrowserUseError(
          "Timed out waiting for browser run completion.",
        );
      }

      run = {
        runId: update.runId,
        status: update.status,
        cursor: update.cursor,
        ...(update.sessionId ? { sessionId: update.sessionId } : {}),
      };
      await delay(pollIntervalMs, signal);
    }
  }

  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<unknown> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Browser-Use-API-Key": this.apiKey,
        ...init.headers,
      },
    });

    if (!response.ok) {
      throw new BrowserUseError(
        `Browser Use request failed with HTTP ${response.status}.`,
        response.status,
      );
    }

    try {
      return (await response.json()) as unknown;
    } catch {
      throw new BrowserUseError("Browser Use returned a non-JSON response.");
    }
  }
}

export class BrowserUseError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "BrowserUseError";
  }
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

function requireStatus(value: unknown): BrowserRunStatus {
  if (
    value === "queued" ||
    value === "dispatching" ||
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value;
  }
  throw new BrowserUseError("Invalid browser run status.");
}

function requireEvents(value: unknown): RunEvent[] {
  if (!Array.isArray(value)) {
    throw new BrowserUseError("Invalid run-events response.");
  }
  return value.map((item) => {
    const event = asRecord(item, "run event");
    if (typeof event.id !== "number" || typeof event.type !== "string") {
      throw new BrowserUseError("Invalid run event.");
    }
    return {
      id: event.id,
      type: event.type,
      data:
        event.data &&
        typeof event.data === "object" &&
        !Array.isArray(event.data)
          ? (event.data as Record<string, unknown>)
          : {},
    };
  });
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

async function delay(
  ms: number,
  signal: AbortSignal | undefined,
): Promise<void> {
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
