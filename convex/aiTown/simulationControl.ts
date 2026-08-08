import { ObjectType, v } from 'convex/values';
import { playerId } from './ids';

export type SimulationSpeed = 1 | 4 | 16;

export const SIMULATION_DURATION_MS = 8 * 60_000;
export const MAX_SIMULATION_CONVERSATIONS = 4;

export function conversationPolicy(speed: SimulationSpeed) {
  switch (speed) {
    case 16:
      return { maxDurationMs: 20_000, maxMessages: 4 };
    case 4:
      return { maxDurationMs: 45_000, maxMessages: 6 };
    case 1:
      return { maxDurationMs: 2 * 60_000, maxMessages: 8 };
  }
}

export const serializedSimulationControl = {
  runId: v.optional(v.string()),
  speed: v.union(v.literal(1), v.literal(4), v.literal(16)),
  startedAt: v.number(),
  // Optional for worlds created before speed-linked simulation controls shipped.
  elapsedSimulationMs: v.optional(v.number()),
  lastSpeedChangedAt: v.optional(v.number()),
  conversationStarts: v.number(),
  participantIds: v.array(playerId),
  conversationPairs: v.optional(
    v.array(v.object({ speakerId: playerId, peerId: playerId })),
  ),
};

export type SerializedSimulationControl = ObjectType<typeof serializedSimulationControl>;

export function simulationElapsedMs(control: SerializedSimulationControl, now: number) {
  return (
    (control.elapsedSimulationMs ?? 0) +
    Math.max(0, now - (control.lastSpeedChangedAt ?? control.startedAt)) * control.speed
  );
}

export function simulationIsComplete(control: SerializedSimulationControl, now: number) {
  return simulationElapsedMs(control, now) >= SIMULATION_DURATION_MS;
}

export function personaConversationPairs<T extends string>(personaIds: T[]): Array<[T, T]> {
  const ids = [...new Set(personaIds)].sort();
  const pairs: Array<[T, T]> = [];
  for (let index = 0; index + 1 < ids.length; index += 2) {
    pairs.push([ids[index], ids[index + 1]]);
  }
  if (ids.length > 1 && ids.length % 2 === 1) {
    pairs.push([ids[ids.length - 1], ids[0]]);
  }
  return pairs.slice(0, MAX_SIMULATION_CONVERSATIONS);
}
