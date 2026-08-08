'use node';

import { v } from 'convex/values';
import { action } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import { fetchEmbedding } from '../util/llm';
import { BrowserUseError } from '../../launch-town-browser/src/browserJourneyRunner';
import type { BrowserJourneyRunner } from '../../launch-town-browser/src/browserJourneyRunner';
import { buildBrowserPrompt } from '../../launch-town-browser/src/browserPromptBuilder';
import {
  FALLBACK_JOURNEY_NOTICE,
  getFallbackJourney,
} from '../../launch-town-browser/src/fallbackJourneys';
import { interpretBrowserResult } from '../../launch-town-browser/src/resultInterpreter';
import type { BrowserJourneyOutput, ProductModel } from '../../launch-town-browser/src/schemas';
import { createBrowserJourneyBackend } from '../../launch-town-browser/src/journeyBackend';

async function runLiveWithRetry(
  taskPrompt: string,
  runner: BrowserJourneyRunner,
  onReady: (runId: string, liveViewUrl: string) => Promise<void>,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await runner.createRun(taskPrompt);
      const completed = await runner.waitForCompletion(handle, {
        timeoutMs: 8 * 60 * 1_000,
        onBrowserReady: (liveViewUrl) => onReady(handle.runId, liveViewUrl),
      });
      return completed;
    } catch (error) {
      lastError = error;
      const statusCode = error instanceof BrowserUseError ? error.statusCode : undefined;
      if (statusCode && statusCode !== 429 && statusCode < 500) break;
    }
  }
  throw lastError;
}

/**
 * Single integration boundary for visit decisions. Live browsing is opt-in and
 * hard-gated to Rohan; every resident has a validated fallback.
 */
export const runForResident = action({
  args: {
    productId: v.id('products'),
    residentKey: v.string(),
    objective: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ browserRunId: Id<'browserRuns'>; source: 'live' | 'fallback' }> => {
    const context = await ctx.runQuery(internal.launchTown.browserRunModel.loadBrowserContext, {
      productId: args.productId,
      residentKey: args.residentKey,
    });
    if (!context || !context.product.productModel) throw new Error('Browser context is incomplete');
    const browserRunId: Id<'browserRuns'> = await ctx.runMutation(
      internal.launchTown.browserRunModel.createBrowserRun,
      args,
    );
    const product: ProductModel = {
      url: context.product.url,
      category: context.product.productModel.category,
      cta: context.product.productModel.primaryCta,
      claims: context.product.productModel.claims,
      likelyConcerns: context.product.productModel.likelyConcerns,
      conversionProxy: context.product.productModel.conversionProxy,
    };
    const prompt = buildBrowserPrompt({
      resident: {
        name: context.profile.name,
        goal: args.objective,
        traits: [
          `need strength ${context.profile.needStrength}`,
          `technical fluency ${context.profile.technicalFluency}`,
          `trust threshold ${context.profile.trustThreshold}`,
          `price sensitivity ${context.profile.priceSensitivity}`,
        ],
      },
      beliefs: context.state.productBeliefs
        .filter((belief) => belief.origin === 'observed')
        .map((belief) => ({ claim: belief.claim, confidence: belief.confidence })),
      hearsay: context.state.productBeliefs
        .filter((belief) => belief.origin === 'hearsay')
        .map((belief) => ({
          claim: belief.claim,
          source: belief.source,
          sourceTrust: context.edges.find(
            (edge) =>
              edge.sourceResidentKey === belief.source &&
              edge.targetResidentKey === args.residentKey,
          )?.relationshipStrength,
        })),
      product,
    });

    const backend = createBrowserJourneyBackend();
    let output: BrowserJourneyOutput | undefined;
    let source: 'live' | 'fallback' = 'fallback';
    if (backend.kind === 'live' && args.residentKey === 'rohan') {
      try {
        await ctx.runMutation(internal.launchTown.browserRunModel.updateBrowserRun, {
          browserRunId,
          status: 'running',
        });
        const completed = await runLiveWithRetry(
          prompt,
          backend.runner,
          async (runId, liveViewUrl) => {
            await ctx.runMutation(internal.launchTown.browserRunModel.updateBrowserRun, {
              browserRunId,
              status: 'ready',
              runId,
              liveViewUrl,
            });
          },
        );
        output = completed.output;
        source = 'live';
      } catch {
        // The fallback is deliberately the default-safe path; live-view URLs and
        // provider errors are not logged because they may contain credentials.
      }
    }
    if (!output) {
      output =
        backend.kind === 'fallback'
          ? backend.getJourney(context.profile.name)?.output
          : getFallbackJourney(context.profile.name)?.output;
    }
    if (!output) throw new Error(`No browser fallback for ${context.profile.name}`);

    const interpreted = interpretBrowserResult(output);
    if (!interpreted.ok)
      throw new Error('Browser result failed the validated interpreter contract');
    const { embedding } = await fetchEmbedding(interpreted.value.memory.summary);
    await ctx.runMutation(internal.launchTown.browserRunModel.applyBrowserResult, {
      browserRunId,
      output,
      ...(source === 'fallback' ? { fallbackNotice: FALLBACK_JOURNEY_NOTICE } : {}),
      embedding,
    });
    if (args.residentKey === 'rohan') {
      await ctx.scheduler.runAfter(
        0,
        internal.launchTown.influenceActions.extractConversationInfluence,
        {
          productId: args.productId,
          conversationId: 'demo-rohan-meera',
          speaker: 'rohan',
          listener: 'meera',
          transcript:
            'Rohan: Priya was right about the early bank-access request, but I checked Ledgerly’s security page first and their documentation is actually solid. Meera: That makes me trust it more, though I still care about the price.',
        },
      );
    }
    return { browserRunId, source };
  },
});
