# LaunchTown Browser + Claude Modules

An isolated TypeScript package for LaunchTown's browser/cognition boundary:

- `BrowserUseJourneyRunner` creates unrecorded Browser Use Cloud V4 runs,
  polls cursor-based events for the credential-bearing live view URL, and
  validates completed structured journey output.
- `BrowserUseV2JourneyRunner` implements the same interface for free-tier V2
  tasks, with recording disabled and a conservative 20-step ceiling.
- `ClaudeProductModelAnalyzer` fetches a public URL through Claude's server-side
  web-fetch tool and returns a strict Product Model.
- `buildBrowserPrompt` creates a natural, social-context-aware browsing task.
- `interpretBrowserResult` safely maps untrusted journey output to deterministic
  state deltas and a `productExperience` memory payload.
- `getFallbackJourney` returns a validated, pre-computed latest journey for each
  seeded resident so the causal demo can continue during a Browser Use outage.

## Environment

Set these only in the server environment:

```sh
BROWSER_USE_API_KEY=...
ANTHROPIC_API_KEY=...
```

The live view URL is a credential. The runner returns it to the caller but does
not log it or include response bodies in error messages.

## Live/fallback switch

One server-side flag selects the backend. It defaults to the fallback and does
not construct a cloud client or consume credits:

```sh
BROWSER_JOURNEY_MODE=fallback # fallback | v2 | v4
```

```ts
const backend = createBrowserJourneyBackend();

if (backend.kind === "fallback") {
  const journey = backend.getJourney("Rohan");
} else {
  const run = await backend.runner.createRun(taskPrompt);
}
```

## Verify

```sh
npm install
npm test
npm run typecheck
npm run build
```
