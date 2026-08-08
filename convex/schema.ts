import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { agentTables } from './agent/schema';
import { aiTownTables } from './aiTown/schema';
import { conversationId, playerId } from './aiTown/ids';
import { engineTables } from './engine/schema';
import {
  behavioralSuggestion,
  browserResult,
  bolnaExecutionStatus,
  influenceSignals,
  outboundCallStatus,
  outboundFailureCode,
  productBelief,
  residentStage,
  safeCallFinding,
  transferredBelief,
} from './launchTown/validators';
import { reportArtifactValidator } from './launchTown/reportArtifactValidator';

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
    analysisStatus: v.union(
      v.literal('seeded'),
      v.literal('pending'),
      v.literal('running'),
      v.literal('complete'),
      v.literal('failed'),
    ),
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

  outboundVoiceCalls: defineTable({
    productId: v.id('products'),
    residentKey: v.string(),
    executionId: v.optional(v.string()),
    status: outboundCallStatus,
    providerStatus: v.optional(bolnaExecutionStatus),
    active: v.boolean(),
    destinationMask: v.string(),
    provider: v.union(v.literal('vobiz'), v.literal('unknown')),
    failureCode: v.optional(outboundFailureCode),
    findings: v.optional(v.array(safeCallFinding)),
    requestedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('active', ['active'])
    .index('requestedAt', ['requestedAt'])
    .index('product_resident_requestedAt', ['productId', 'residentKey', 'requestedAt']),

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
  })
    .index('slug', ['slug'])
    .index('product', ['productId']),

  launchReports: defineTable({
    productId: v.id('products'),
    status: v.union(v.literal('running'), v.literal('complete'), v.literal('failed')),
    attempts: v.number(),
    leaseId: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    artifact: v.optional(reportArtifactValidator),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('product', ['productId']),

  launchTownSettings: defineTable({
    key: v.string(),
    count: v.number(),
    limit: v.number(),
  }).index('key', ['key']),

  ...agentTables,
  ...aiTownTables,
  ...engineTables,
});
