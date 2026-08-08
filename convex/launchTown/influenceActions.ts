import { v } from 'convex/values';
import { internalAction } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import { chatCompletion, fetchEmbedding } from '../util/llm';
import type { InfluenceEvent, ResidentState } from './types';

function parseInfluenceEvent(raw: string, listener: string, speaker: string): InfluenceEvent {
  const candidate = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const parsed = JSON.parse(candidate) as Partial<InfluenceEvent>;
  if (parsed.listener?.toLowerCase() !== listener) {
    throw new Error('Claude influence event targeted an unexpected listener');
  }
  const signalNames = ['awareness', 'curiosity', 'trust'] as const;
  if (!parsed.signals || signalNames.some((name) => !Number.isFinite(parsed.signals?.[name]))) {
    throw new Error('Claude influence event contained invalid signals');
  }
  if (!Array.isArray(parsed.beliefs))
    throw new Error('Claude influence event contained invalid beliefs');
  const beliefs = parsed.beliefs
    .filter(
      (belief) => belief && typeof belief.claim === 'string' && Number.isFinite(belief.confidence),
    )
    .map((belief) => ({
      claim: belief.claim,
      confidence: Math.min(1, Math.max(0, belief.confidence)),
      source: speaker,
    }));
  const suggestions = ['investigate', 'visit', 'avoid', 'share', 'none'] as const;
  const behavioralSuggestion = suggestions.includes(
    parsed.behavioralSuggestion as (typeof suggestions)[number],
  )
    ? (parsed.behavioralSuggestion as (typeof suggestions)[number])
    : 'none';
  return {
    listener,
    signals: {
      awareness: Math.min(1, Math.max(-1, parsed.signals.awareness)),
      curiosity: Math.min(1, Math.max(-1, parsed.signals.curiosity)),
      trust: Math.min(1, Math.max(-1, parsed.signals.trust)),
    },
    beliefs,
    behavioralSuggestion,
  };
}

type AppliedResult = {
  state: ResidentState;
  deltas: InfluenceEvent['signals'];
  playerId?: string;
};

export const extractConversationInfluence = internalAction({
  args: {
    productId: v.id('products'),
    conversationId: v.string(),
    speaker: v.string(),
    listener: v.string(),
    transcript: v.string(),
  },
  handler: async (ctx, args): Promise<AppliedResult> => {
    const speaker = args.speaker.toLowerCase();
    const listener = args.listener.toLowerCase();
    const { content } = await chatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'Extract semantic social influence. Output one JSON object only. Signals are numbers from -1 to 1. Do not apply state changes.',
        },
        {
          role: 'user',
          content: `How did ${speaker} influence ${listener} in this conversation?\n${args.transcript}\n\nReturn: {"listener":"${listener}","signals":{"awareness":0,"curiosity":0,"trust":0},"beliefs":[{"claim":"...","confidence":0.0,"source":"${speaker}"}],"behavioralSuggestion":"investigate|visit|avoid|share|none"}`,
        },
      ],
      temperature: 0,
      max_tokens: 500,
    });
    const event = parseInfluenceEvent(content, listener, speaker);
    const applied: AppliedResult = await ctx.runMutation(
      internal.launchTown.influenceModel.applyExtractedInfluence,
      { ...args, speaker, listener, event },
    );
    if (event.beliefs.length > 0 && applied.playerId) {
      const description = `I heard from ${speaker}: ${event.beliefs.map((belief) => belief.claim).join('; ')}`;
      const { embedding } = await fetchEmbedding(description);
      await ctx.runMutation(internal.launchTown.influenceModel.insertHearsayMemory, {
        productId: args.productId,
        playerId: applied.playerId,
        sourceResidentKey: speaker,
        description,
        beliefs: event.beliefs,
        embedding,
      });
    }
    if (event.behavioralSuggestion === 'investigate' || event.behavioralSuggestion === 'visit') {
      await ctx.scheduler.runAfter(0, internal.launchTown.behaviorActions.decideAfterInfluence, {
        productId: args.productId,
        residentKey: listener,
      });
    }
    return applied;
  },
});
