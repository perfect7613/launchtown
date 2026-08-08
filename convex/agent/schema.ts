import { v } from 'convex/values';
import { playerId, conversationId } from '../aiTown/ids';
import { defineTable } from 'convex/server';
import { EMBEDDING_DIMENSION } from '../util/llm';

export const memoryFields = {
  playerId,
  description: v.string(),
  // Seeded demo memories may be recency-only until an embedding provider is configured.
  // Vector-backed AI Town retrieval remains unchanged for every embedded memory.
  embeddingId: v.optional(v.id('memoryEmbeddings')),
  importance: v.number(),
  lastAccess: v.number(),
  data: v.union(
    // Setting up dynamics between players
    v.object({
      type: v.literal('relationship'),
      // The player this memory is about, from the perspective of the player
      // whose memory this is.
      playerId,
    }),
    v.object({
      type: v.literal('conversation'),
      conversationId,
      // The other player(s) in the conversation.
      playerIds: v.array(playerId),
    }),
    v.object({
      type: v.literal('reflection'),
      relatedMemoryIds: v.array(v.id('memories')),
    }),
    v.object({
      type: v.literal('productExperience'),
      productId: v.id('products'),
      browserRunId: v.optional(v.id('browserRuns')),
      outcome: v.string(),
      pagesVisited: v.array(v.string()),
      observedAt: v.number(),
    }),
    v.object({
      type: v.literal('productHearsay'),
      productId: v.id('products'),
      sourceResidentKey: v.string(),
      claim: v.string(),
      confidence: v.number(),
      heardAt: v.number(),
    }),
  ),
};
export const memoryTables = {
  memories: defineTable(memoryFields)
    .index('embeddingId', ['embeddingId'])
    .index('playerId_type', ['playerId', 'data.type'])
    .index('playerId', ['playerId']),
  memoryEmbeddings: defineTable({
    playerId,
    embedding: v.array(v.float64()),
  }).vectorIndex('embedding', {
    vectorField: 'embedding',
    filterFields: ['playerId'],
    dimensions: EMBEDDING_DIMENSION,
  }),
};

export const agentTables = {
  ...memoryTables,
  embeddingsCache: defineTable({
    textHash: v.bytes(),
    embedding: v.array(v.float64()),
  }).index('text', ['textHash']),
};
