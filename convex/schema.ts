import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { agentTables } from './agent/schema';
import { aiTownTables } from './aiTown/schema';
import { conversationId, playerId } from './aiTown/ids';
import { engineTables } from './engine/schema';
import {
  behavioralSuggestion,
  browserResult,
  influenceSignals,
  productBelief,
  residentStage,
  transferredBelief,
} from './launchTown/validators';

export default defineSchema({
  messages: defineTable({
    conversationId,
    messageUuid: v.string(),
    author: playerId,
    text: v.string(),
    worldId: v.optional(v.id('worlds')),
  })
    .index('conversationId', ['worldId', 'conversationId'])
    .index('messageUuid', ['conversationId', 'messageUuid']),

  products: defineTable({
    slug: v.string(),
    name: v.string(),
    url: v.string(),
    analysisStatus: v.union(v.literal('seeded'), v.literal('pending'), v.literal('complete')),
    productModel: v.optional(
      v.object({
        category: v.string(),
        primaryCta: v.string(),
        claims: v.array(v.string()),
        likelyConcerns: v.array(v.string()),
        conversionProxy: v.string(),
      }),
    ),
  }).index('slug', ['slug']),

  residentProfiles: defineTable({
    productId: v.id('products'),
    residentKey: v.string(),
    name: v.string(),
    role: v.string(),
    needStrength: v.number(),
    priceSensitivity: v.number(),
    technicalFluency: v.number(),
    trustThreshold: v.number(),
    socialSusceptibility: v.number(),
    noveltySeeking: v.number(),
    patience: v.number(),
  })
    .index('product', ['productId'])
    .index('product_resident', ['productId', 'residentKey']),

  residentStates: defineTable({
    productId: v.id('products'),
    residentKey: v.string(),
    awareness: v.number(),
    curiosity: v.number(),
    trust: v.number(),
    purchaseIntent: v.number(),
    sentiment: v.number(),
    stage: residentStage,
    productBeliefs: v.array(productBelief),
    socialProof: v.number(),
    expectedFriction: v.number(),
    updatedAt: v.number(),
  })
    .index('product', ['productId'])
    .index('product_resident', ['productId', 'residentKey']),

  socialEdges: defineTable({
    productId: v.id('products'),
    sourceResidentKey: v.string(),
    targetResidentKey: v.string(),
    relationshipStrength: v.number(),
  })
    .index('product', ['productId'])
    .index('source_target', ['productId', 'sourceResidentKey', 'targetResidentKey']),

  influenceEvents: defineTable({
    productId: v.id('products'),
    conversationId: v.optional(v.string()),
    speaker: v.string(),
    listener: v.string(),
    signals: influenceSignals,
    beliefs: v.array(transferredBelief),
    behavioralSuggestion,
    relationshipStrength: v.number(),
    socialSusceptibility: v.number(),
    appliedDeltas: influenceSignals,
    createdAt: v.number(),
    causedBrowserRunId: v.optional(v.id('browserRuns')),
  })
    .index('product', ['productId'])
    .index('listener', ['productId', 'listener']),

  browserRuns: defineTable({
    productId: v.id('products'),
    residentKey: v.string(),
    runId: v.optional(v.string()),
    status: v.union(
      v.literal('queued'),
      v.literal('stubbed'),
      v.literal('running'),
      v.literal('ready'),
      v.literal('completed'),
      v.literal('failed'),
    ),
    objective: v.string(),
    liveViewUrl: v.optional(v.string()),
    fallbackNotice: v.optional(v.string()),
    result: v.optional(browserResult),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('product', ['productId'])
    .index('product_resident', ['productId', 'residentKey']),

  scenarioPhases: defineTable({
    productId: v.id('products'),
    slug: v.string(),
    phase: v.union(
      v.literal('seeded'),
      v.literal('priyaToRohan'),
      v.literal('rohanBrowsing'),
      v.literal('rohanToMeera'),
      v.literal('complete'),
    ),
    speed: v.union(v.literal(1), v.literal(4), v.literal(16)),
    simulationDay: v.number(),
    elapsedSimulationMs: v.number(),
    startedAt: v.optional(v.number()),
    lastClockAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index('slug', ['slug']),

  ...agentTables,
  ...aiTownTables,
  ...engineTables,
});
