'use node';

import { v } from 'convex/values';
import { internalAction } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import { fetchEmbedding } from '../util/llm';
import type { BrowserJourneyRunner } from '../../launch-town-browser/src/browserJourneyRunner';
import { buildBrowserPrompt } from '../../launch-town-browser/src/browserPromptBuilder';
import {
  FALLBACK_JOURNEY_NOTICE,
  getFallbackJourney,
} from '../../launch-town-browser/src/fallbackJourneys';
import { interpretBrowserResult } from '../../launch-town-browser/src/resultInterpreter';
import type { BrowserJourneyOutput, ProductModel } from '../../launch-town-browser/src/schemas';
import { createBrowserJourneyBackend } from '../../launch-town-browser/src/journeyBackend';
import { isBrowserFallbackAllowed } from './browserRunPolicy';

async function runLive(
  taskPrompt: string,
  runner: BrowserJourneyRunner,
  context: {
    simulationRunId: string;
    productId: string;
    productUrl: string;
    personaKey: string;
  },
  onCreated: (sessionId: string, sessionStatus?: 'PENDING' | 'RUNNING' | 'ERROR' | 'TIMED_OUT' | 'COMPLETED') => Promise<void>,
) {
  const handle = await runner.createRun(taskPrompt, context);
  await onCreated(handle.sessionId ?? handle.runId, handle.sessionStatus);
  return await runner.waitForCompletion(handle, {
    timeoutMs: 8 * 60 * 1_000,
  });
}

/**
 * Single integration boundary for an isolated per-persona browser journey.
 */
export const runForResident = internalAction({
  args: {
    productId: v.id('products'),
    residentKey: v.string(),
    objective: v.string(),
    simulationRunId: v.optional(v.string()),
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
    const simulationRunId = args.simulationRunId ?? crypto.randomUUID();
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
    let sessionId: string | undefined;
    let sessionStatus: 'PENDING' | 'RUNNING' | 'ERROR' | 'TIMED_OUT' | 'COMPLETED' | undefined;
    if (backend.kind === 'live') {
      try {
        await ctx.runMutation(internal.launchTown.browserRunModel.updateBrowserRun, {
          browserRunId,
          status: 'running',
        });
        const completed = await runLive(
          prompt,
          backend.runner,
          {
            simulationRunId,
            productId: String(args.productId),
            productUrl: context.product.url,
            personaKey: args.residentKey,
          },
          async (createdSessionId, createdStatus) => {
            sessionId = createdSessionId;
            sessionStatus = createdStatus;
            await ctx.runMutation(internal.launchTown.browserRunModel.updateBrowserRun, {
              browserRunId,
              status: 'running',
              sessionId: createdSessionId,
              sessionStatus: createdStatus,
              source: 'live',
            });
          },
        );
        output = completed.output;
        sessionStatus = completed.sessionStatus;
        source = 'live';
      } catch {
        if (!isBrowserFallbackAllowed(context.product.slug)) {
          await ctx.runMutation(internal.launchTown.browserRunModel.markBrowserRunFailed, {
            browserRunId,
            source: 'error',
            sessionId,
            sessionStatus,
            fallbackNotice: 'Live browser journey failed; no cross-product fallback was used.',
          });
          throw new Error(`Live browser journey failed for ${args.residentKey}`);
        }
      }
    }
    if (!output) {
      if (!isBrowserFallbackAllowed(context.product.slug)) {
        await ctx.runMutation(internal.launchTown.browserRunModel.markBrowserRunFailed, {
          browserRunId,
          source: 'error',
          fallbackNotice: 'Live browser is unavailable; custom-product fallback is disabled.',
        });
        throw new Error(`Live browser is unavailable for ${args.residentKey}`);
      }
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
      source,
      sessionId,
      sessionStatus,
      ...(source === 'fallback' ? { fallbackNotice: FALLBACK_JOURNEY_NOTICE } : {}),
      embedding,
    });
    return { browserRunId, source };
  },
});
