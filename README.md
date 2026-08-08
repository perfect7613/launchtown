# LaunchTown

LaunchTown is a causal launch simulator: eight autonomous residents discover a product, browse it,
talk to people they trust, and change one another's awareness, curiosity, trust, and intent. The
demo is designed to make each adoption step inspectable instead of presenting an opaque aggregate
score.

Open `/demo/ledgerly`, press **Start Simulation**, and use the 1×/4×/16× scenario clock to follow
the seeded Ledgerly cascade.

## How the simulation works

1. A resident's next action is chosen by a deterministic behavior policy (`talk`, `browse`, or
   `idle`). Visit probability is a sigmoid over need, awareness, curiosity, social proof, distrust,
   and expected friction.
2. Claude extracts semantic signals from a conversation into a validated influence-event shape.
3. A pure state reducer applies each signal as:

   ```text
   delta = signal × relationshipStrength × socialSusceptibility
   ```

4. Browser results pass through a validated interpreter before deterministic state deltas and a
   `productExperience` memory are written.

Claude never writes resident state directly. Every mutation is applied and audited by deterministic
code. The 1×/4×/16× scenario clock is layered above AI Town's tick engine; it does not modify tick
mechanics.

## Demo population

The Ledgerly scenario seeds Priya, Rohan, Meera, Ananya, Dev, Karan, Sneha, and Aarav. Priya and
Rohan have a bidirectional relationship strength of `0.9`; Rohan and Meera have `0.7`. Priya's
initial visit is pre-baked so the demo starts at the first social handoff.

## AI and browser providers

- Chat and structured influence extraction: Anthropic Claude
- Memory embeddings: OpenAI `text-embedding-3-small` (`1536` dimensions)
- Browser journeys: the isolated `launch-town-browser` package

`BROWSER_JOURNEY_MODE` defaults to `fallback`, using the pre-computed journey catalog for a reliable
demo. Setting it to `browserbase` enables the Browserbase + Stagehand adapter, but LaunchTown still
permits a live run only for the demo-critical resident Rohan; every other resident continues to use
fallback data. Live-view URLs are treated as credentials and are never logged.

## Local development

Prerequisites: Node.js, npm, and a Convex project.

```sh
npm install
npx convex dev --once --run init
npm run dev
```

The app runs at `http://localhost:5173`; the demo route is `http://localhost:5173/demo/ledgerly`.

Set provider secrets in Convex, never in committed files:

```sh
npx convex env set ANTHROPIC_API_KEY '<key>'
npx convex env set OPENAI_API_KEY '<key>'
npx convex env set EMBEDDING_PROVIDER openai
npx convex env set BROWSER_JOURNEY_MODE fallback
```

Optional live-browser configuration:

```sh
npx convex env set BROWSERBASE_API_KEY '<key>'
npx convex env set BROWSERBASE_PROJECT_ID '<project-id>'
npx convex env set BROWSER_JOURNEY_MODE browserbase
```

Do not enable the live mode for routine development or integration tests. The fallback route
exercises the same persistence and result-interpretation boundary without consuming browser minutes.

## Verification

```sh
npm test
npm run build
npm --prefix launch-town-browser test
npm --prefix launch-town-browser run typecheck
npm --prefix launch-town-browser run build
```

## Architecture map

- `convex/launchTown/influence.ts` — pure influence reducer
- `convex/launchTown/behavior.ts` — pure visit probability and action policy
- `convex/launchTown/influenceActions.ts` — Claude extraction boundary
- `convex/launchTown/browserRunner.ts` — Convex/browser integration boundary
- `convex/launchTown/scenario.ts` — Ledgerly seed, start, and scenario clock
- `launch-town-browser/` — standalone browser runners, prompt builder, interpreter, and fallbacks

## Attribution

LaunchTown vendors [a16z AI Town](https://github.com/a16z-infra/ai-town) as its React, PixiJS, and
Convex simulation foundation. AI Town is MIT licensed; its original license and notices are
preserved in [LICENSE](./LICENSE). LaunchTown removes authentication, human-play controls, and
background music, then adds the causal product-adoption model described above.
