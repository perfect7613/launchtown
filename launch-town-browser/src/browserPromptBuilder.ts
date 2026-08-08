import type { ProductModel } from "./schemas.js";

export interface ResidentProfile {
  name: string;
  goal?: string;
  traits: readonly string[];
}

export interface ResidentBelief {
  claim: string;
  confidence?: number;
}

export interface HearsayBelief {
  claim: string;
  source: string;
  sourceTrust?: number;
}

export interface BrowserPromptInput {
  resident: ResidentProfile;
  beliefs: readonly ResidentBelief[];
  hearsay: readonly HearsayBelief[];
  product: ProductModel;
}

const formatConfidence = (confidence: number | undefined): string => {
  if (confidence === undefined) return "";
  const percent = Math.round(Math.min(1, Math.max(0, confidence)) * 100);
  return ` (confidence: ${percent}%)`;
};

const describeTrust = (trust: number | undefined): string => {
  if (trust === undefined) return "";
  if (trust >= 0.75) return " whom you trust strongly";
  if (trust >= 0.45) return " whom you trust";
  return " whose view you treat cautiously";
};

/** Builds the social-context-aware task sent to the browser agent. */
export function buildBrowserPrompt(input: BrowserPromptInput): string {
  const { resident, beliefs, hearsay, product } = input;
  const goal =
    resident.goal?.trim() ||
    `evaluate whether this ${product.category} product would work for you`;

  const sections = [
    `You are ${resident.name}. Goal: ${goal}.`,
    resident.traits.length > 0
      ? `Your relevant traits:\n${resident.traits.map((trait) => `- ${trait}`).join("\n")}`
      : "",
    beliefs.length > 0
      ? `What you currently believe:\n${beliefs
          .map(
            (belief) =>
              `- ${belief.claim}${formatConfidence(belief.confidence)}`,
          )
          .join("\n")}`
      : "",
    hearsay.length > 0
      ? `What you have heard from other people:\n${hearsay
          .map(
            (item) =>
              `- From ${item.source}${describeTrust(item.sourceTrust)}: ${item.claim}`,
          )
          .join("\n")}`
      : "",
    `The product presents itself as ${product.category}. Its primary call to action is "${product.cta}", and the meaningful conversion boundary is: ${product.conversionProxy}.`,
    `Browse ${product.url} naturally, as a prospective customer, not a QA tester. Use your own judgment and verify claims that matter to you. Stop when you would naturally leave, postpone, reject, or reach the primary conversion boundary. Never make real purchases or consequential transactions.`,
  ];

  return sections.filter(Boolean).join("\n\n");
}
