import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  ProductModelAnalysisSchema,
  ProductModelSchema,
  type ProductModel,
} from "./schemas.js";

export interface ProductModelAnalyzer {
  analyze(url: string): Promise<ProductModel>;
}

export interface ClaudeProductModelAnalyzerOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

const DEFAULT_MODEL = "claude-sonnet-5";

export class ClaudeProductModelAnalyzer implements ProductModelAnalyzer {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(options: ClaudeProductModelAnalyzerOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required.");
    }

    this.client = new Anthropic({ apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? 1_024;
  }

  async analyze(url: string): Promise<ProductModel> {
    const parsedUrl = parsePublicUrl(url);

    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: this.maxTokens,
      system:
        "You analyze public product websites for a pre-production user-behavior simulation. Ground every field in the fetched page. Do not invent product capabilities, log in, submit forms, or take consequential actions.",
      messages: [
        {
          role: "user",
          content: `Fetch and analyze ${parsedUrl.href}. Return a concise Product Model: the product category, its primary CTA, its explicit marketing claims, concerns a prospective customer would likely investigate, and the observable action that serves as a conversion proxy.`,
        },
      ],
      tools: [
        {
          type: "web_fetch_20260318",
          name: "web_fetch",
          allowed_domains: [parsedUrl.hostname],
          max_uses: 3,
          max_content_tokens: 20_000,
          citations: { enabled: true },
        },
      ],
      output_config: {
        format: zodOutputFormat(ProductModelAnalysisSchema),
      },
    });

    if (!response.parsed_output) {
      throw new Error("Claude did not return a valid Product Model.");
    }

    return ProductModelSchema.parse({
      ...response.parsed_output,
      url: parsedUrl.href,
    });
  }
}

function parsePublicUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Product URL must be a valid HTTP or HTTPS URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Product URL must be a valid HTTP or HTTPS URL.");
  }
  return url;
}
