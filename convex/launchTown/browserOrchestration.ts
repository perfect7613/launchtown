import { v } from 'convex/values';
import { action } from '../_generated/server';
import { internal } from '../_generated/api';
import { MAX_BROWSERBASE_CONCURRENCY } from './browserRunPolicy';

export const runAllPersonaJourneys = action({
  args: {
    productId: v.id('products'),
    simulationRunId: v.string(),
  },
  handler: async (ctx, args) => {
    const personaKeys = await ctx.runQuery(
      internal.launchTown.browserRunModel.listPersonaKeys,
      { productId: args.productId },
    );
    const results: Array<{ personaKey: string; source: 'live' | 'fallback' | 'error' }> = [];
    let cursor = 0;
    const worker = async () => {
      while (cursor < personaKeys.length) {
        const personaKey = personaKeys[cursor++];
        try {
          const result = await ctx.runAction(internal.launchTown.browserRunner.runForResident, {
            ...args,
            residentKey: personaKey,
            objective: 'Evaluate the selected product using this persona\'s needs and trust criteria',
          });
          results.push({ personaKey, source: result.source });
        } catch {
          results.push({ personaKey, source: 'error' });
        }
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(MAX_BROWSERBASE_CONCURRENCY, personaKeys.length) },
        () => worker(),
      ),
    );
    await ctx.runMutation(internal.launchTown.simulationRunModel.finishBrowserPhase, {
      runId: args.simulationRunId,
      hasErrors: results.some((result) => result.source === 'error'),
    });
    return { simulationRunId: args.simulationRunId, results };
  },
});
