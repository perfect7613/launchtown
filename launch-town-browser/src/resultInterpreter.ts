import {
  BrowserJourneyOutputSchema,
  type BrowserJourneyOutput,
} from "./schemas.js";

export interface ProductExperienceMemory {
  type: "productExperience";
  summary: string;
  details: {
    pagesVisited: string[];
    converted: boolean;
    frictions: string[];
    positiveSignals: string[];
    shareLikelihood: number;
  };
}

export interface InterpretedBrowserResult {
  stateDeltas: {
    trust: number;
    purchaseIntent: number;
  };
  memory: ProductExperienceMemory;
}

export type BrowserResultInterpretation =
  | { ok: true; value: InterpretedBrowserResult }
  | {
      ok: false;
      error: {
        code: "invalid_browser_output";
        issues: string[];
      };
    };

const decodeInput = (input: unknown): unknown => {
  if (typeof input !== "string") return input;
  return JSON.parse(input) as unknown;
};

/** Validates untrusted agent output before it can affect simulation state. */
export function interpretBrowserResult(
  input: unknown,
): BrowserResultInterpretation {
  let decoded: unknown;
  try {
    decoded = decodeInput(input);
  } catch {
    return {
      ok: false,
      error: {
        code: "invalid_browser_output",
        issues: ["Output is not valid JSON."],
      },
    };
  }

  const parsed = BrowserJourneyOutputSchema.safeParse(decoded);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "invalid_browser_output",
        issues: parsed.error.issues.map(
          (issue) =>
            `${issue.path.length > 0 ? issue.path.join(".") : "output"}: ${issue.message}`,
        ),
      },
    };
  }

  return { ok: true, value: mapBrowserOutput(parsed.data) };
}

function mapBrowserOutput(
  output: BrowserJourneyOutput,
): InterpretedBrowserResult {
  return {
    stateDeltas: {
      trust: output.trustDelta,
      purchaseIntent: output.intentDelta,
    },
    memory: {
      type: "productExperience",
      summary: output.outcome,
      details: {
        pagesVisited: [...output.pagesVisited],
        converted: output.converted,
        frictions: [...output.frictions],
        positiveSignals: [...output.positiveSignals],
        shareLikelihood: output.shareLikelihood,
      },
    },
  };
}
