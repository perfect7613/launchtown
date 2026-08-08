import { describe, expect, it } from "vitest";
import { buildBrowserPrompt } from "../src/browserPromptBuilder.js";

const product = {
  url: "https://ledgerly.example",
  category: "cash-flow management software",
  cta: "Start free",
  claims: ["See cash flow in real time"],
  likelyConcerns: ["Bank access"],
  conversionProxy: "reaching the account-creation boundary",
};

describe("buildBrowserPrompt", () => {
  it("includes hearsay and its trusted source in the browsing context", () => {
    const prompt = buildBrowserPrompt({
      resident: {
        name: "Rohan",
        goal: "evaluate whether Ledgerly would work for your startup",
        traits: ["Technically sophisticated", "Verifies security claims"],
      },
      beliefs: [],
      hearsay: [
        {
          source: "Priya",
          sourceTrust: 0.9,
          claim: "Ledgerly asks for bank access very early and that felt uncomfortable.",
        },
      ],
      product,
    });

    expect(prompt).toContain("From Priya whom you trust strongly");
    expect(prompt).toContain("asks for bank access very early");
    expect(prompt).toContain(
      "Never make real purchases or consequential transactions.",
    );
  });

  it("omits the hearsay section when the resident has heard nothing", () => {
    const prompt = buildBrowserPrompt({
      resident: {
        name: "Meera",
        traits: ["Price-sensitive freelancer"],
      },
      beliefs: [{ claim: "The price may be too high", confidence: 0.6 }],
      hearsay: [],
      product,
    });

    expect(prompt).not.toContain("What you have heard from other people");
    expect(prompt).not.toContain("From undefined");
    expect(prompt).toContain("The price may be too high");
    expect(prompt).toContain("Browse https://ledgerly.example naturally");
  });
});
