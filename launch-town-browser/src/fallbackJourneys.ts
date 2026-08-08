import {
  BrowserJourneyOutputSchema,
  type BrowserJourneyOutput,
} from "./schemas.js";

export const FALLBACK_JOURNEY_NOTICE =
  "Live browser unavailable — showing last completed journey";

export const DEMO_RESIDENT_NAMES = [
  "Priya",
  "Rohan",
  "Meera",
  "Ananya",
  "Dev",
  "Karan",
  "Sneha",
  "Aarav",
] as const;

export type DemoResidentName = (typeof DEMO_RESIDENT_NAMES)[number];

export interface FallbackJourney {
  source: "lastCompletedJourney";
  notice: typeof FALLBACK_JOURNEY_NOTICE;
  residentName: DemoResidentName;
  output: BrowserJourneyOutput;
}

const LEDGERLY = "https://ledgerly-demo-six.vercel.app";

const fallbackOutputs: Record<DemoResidentName, BrowserJourneyOutput> = {
  Priya: {
    outcome:
      "The core cash-flow features looked useful, but the early bank-access request stopped signup.",
    pagesVisited: [LEDGERLY, `${LEDGERLY}/pricing`, `${LEDGERLY}/signup`],
    converted: false,
    frictions: ["Bank access was requested before enough trust was established"],
    positiveSignals: ["The core cash-flow workflow matched an agency need"],
    trustDelta: -0.16,
    intentDelta: -0.12,
    shareLikelihood: 0.78,
  },
  Rohan: {
    outcome:
      "Priya's warning led to a security-first review; the documentation restored some trust, but signup was postponed.",
    pagesVisited: [
      `${LEDGERLY}/security`,
      LEDGERLY,
      `${LEDGERLY}/pricing`,
      `${LEDGERLY}/signup`,
    ],
    converted: false,
    frictions: ["Bank connection still appeared early in onboarding"],
    positiveSignals: ["Security controls and encryption practices were explained clearly"],
    trustDelta: 0.18,
    intentDelta: 0.08,
    shareLikelihood: 0.82,
  },
  Meera: {
    outcome:
      "The product looked useful, but the monthly price required more consideration.",
    pagesVisited: [LEDGERLY, `${LEDGERLY}/pricing`],
    converted: false,
    frictions: ["The monthly price felt high for an independent freelancer"],
    positiveSignals: ["The value proposition was easy to understand"],
    trustDelta: 0.04,
    intentDelta: -0.06,
    shareLikelihood: 0.42,
  },
  Ananya: {
    outcome:
      "The homepage was understandable, but connecting financial data felt too technical to attempt alone.",
    pagesVisited: [LEDGERLY, `${LEDGERLY}/signup`],
    converted: false,
    frictions: ["The bank-connection step lacked enough plain-language guidance"],
    positiveSignals: ["The promised cash-flow overview sounded valuable"],
    trustDelta: -0.08,
    intentDelta: -0.1,
    shareLikelihood: 0.35,
  },
  Dev: {
    outcome:
      "The product felt novel enough to explore through the conversion boundary without making a consequential transaction.",
    pagesVisited: [LEDGERLY, `${LEDGERLY}/pricing`, `${LEDGERLY}/signup`],
    converted: true,
    frictions: ["The bank request arrived before a guided product preview"],
    positiveSignals: ["The product offered a focused, modern workflow"],
    trustDelta: 0.06,
    intentDelta: 0.2,
    shareLikelihood: 0.74,
  },
  Karan: {
    outcome:
      "Broad claims were not supported with enough proof to overcome skepticism.",
    pagesVisited: [LEDGERLY, `${LEDGERLY}/security`],
    converted: false,
    frictions: ["Marketing claims lacked customer evidence and independent proof"],
    positiveSignals: ["A dedicated security page was available"],
    trustDelta: -0.12,
    intentDelta: -0.15,
    shareLikelihood: 0.68,
  },
  Sneha: {
    outcome:
      "The security page answered several questions, but the data-access boundary still needed internal approval.",
    pagesVisited: [
      LEDGERLY,
      `${LEDGERLY}/security`,
      `${LEDGERLY}/signup`,
    ],
    converted: false,
    frictions: ["No visible approval workflow for finance teams"],
    positiveSignals: ["Security documentation was detailed and easy to locate"],
    trustDelta: 0.12,
    intentDelta: 0.04,
    shareLikelihood: 0.64,
  },
  Aarav: {
    outcome:
      "The product was credible and relevant, but not urgent enough to start immediately.",
    pagesVisited: [LEDGERLY, `${LEDGERLY}/pricing`, `${LEDGERLY}/security`],
    converted: false,
    frictions: ["The site did not establish an urgent reason to switch"],
    positiveSignals: ["Pricing and security information were both accessible"],
    trustDelta: 0.08,
    intentDelta: 0.02,
    shareLikelihood: 0.5,
  },
};

for (const output of Object.values(fallbackOutputs)) {
  BrowserJourneyOutputSchema.parse(output);
}

/** Returns a defensive copy of a resident's latest known-good demo journey. */
export function getFallbackJourney(
  residentName: string,
): FallbackJourney | undefined {
  const canonicalName = DEMO_RESIDENT_NAMES.find(
    (name) => name.toLowerCase() === residentName.trim().toLowerCase(),
  );
  if (!canonicalName) return undefined;

  const output = fallbackOutputs[canonicalName];
  return {
    source: "lastCompletedJourney",
    notice: FALLBACK_JOURNEY_NOTICE,
    residentName: canonicalName,
    output: {
      ...output,
      pagesVisited: [...output.pagesVisited],
      frictions: [...output.frictions],
      positiveSignals: [...output.positiveSignals],
    },
  };
}
