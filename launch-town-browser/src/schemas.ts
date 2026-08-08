import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);

export const ProductModelAnalysisSchema = z
  .object({
    category: nonEmptyText,
    cta: nonEmptyText,
    claims: z.array(nonEmptyText).max(12),
    likelyConcerns: z.array(nonEmptyText).max(12),
    conversionProxy: nonEmptyText,
  })
  .strict();

export const ProductModelSchema = ProductModelAnalysisSchema.extend({
  url: z.url(),
}).strict();

export const BrowserJourneyOutputSchema = z
  .object({
    outcome: nonEmptyText,
    pagesVisited: z.array(nonEmptyText).max(100),
    converted: z.boolean(),
    frictions: z.array(nonEmptyText).max(50),
    positiveSignals: z.array(nonEmptyText).max(50),
    trustDelta: z.number().finite().min(-1).max(1),
    intentDelta: z.number().finite().min(-1).max(1),
    shareLikelihood: z.number().finite().min(0).max(1),
  })
  .strict();

export type ProductModel = z.infer<typeof ProductModelSchema>;
export type BrowserJourneyOutput = z.infer<typeof BrowserJourneyOutputSchema>;
