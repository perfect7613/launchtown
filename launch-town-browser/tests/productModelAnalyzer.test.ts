import { describe, expect, it } from "vitest";
import { ClaudeProductModelAnalyzer } from "../src/productModelAnalyzer.js";

describe("ClaudeProductModelAnalyzer", () => {
  it("rejects URLs containing credentials before sending them to Claude", async () => {
    const analyzer = new ClaudeProductModelAnalyzer({ apiKey: "test-key" });

    await expect(
      analyzer.analyze("https://user:secret@example.com"),
    ).rejects.toThrow("Product URL must not contain credentials.");
  });
});
