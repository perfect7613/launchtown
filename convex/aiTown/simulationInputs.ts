import { v } from 'convex/values';
import { Conversation } from './conversation';
import { inputHandler } from './inputHandler';
import { personaConversationPairs, simulationElapsedMs } from './simulationControl';

export const simulationInputs = {
  startSimulationControl: inputHandler({
    args: {
      speed: v.union(v.literal(1), v.literal(4), v.literal(16)),
      runId: v.string(),
    },
    handler: (game, now, { speed, runId }) => {
      // A new run owns a fresh, deterministic conversation set. Provider
      // responses from the previous run are stale and cannot revive it.
      for (const agent of game.world.agents.values()) delete agent.inProgressOperation;
      for (const conversation of [...game.world.conversations.values()]) {
        conversation.stop(game, now);
      }
      game.world.simulationControl = {
        runId,
        speed,
        startedAt: now,
        elapsedSimulationMs: 0,
        lastSpeedChangedAt: now,
        conversationStarts: 0,
        participantIds: [],
        conversationPairs: [],
      };

      // Four pairwise conversations cover all eight personas without paying
      // for every possible pair. Starting them together keeps 16x bounded.
      const players = [...game.world.agents.values()]
        .map((agent) => game.world.players.get(agent.playerId))
        .filter((player): player is NonNullable<typeof player> => !!player)
        .map((player) => [player.id, player] as const);
      const playersById = new Map(players);
      for (const [firstId, secondId] of personaConversationPairs([...playersById.keys()])) {
        const first = playersById.get(firstId)!;
        const second = playersById.get(secondId)!;
        const result = Conversation.start(game, now, first, second);
        if (!result.conversationId) continue;
        const conversation = game.world.conversations.get(result.conversationId)!;
        for (const member of conversation.participants.values()) {
          member.status = { kind: 'participating', started: now };
        }
        game.world.simulationControl.conversationStarts += 1;
        game.world.simulationControl.participantIds.push(first.id, second.id);
        game.world.simulationControl.conversationPairs!.push({
          speakerId: first.id,
          peerId: second.id,
        });
      }
      return null;
    },
  }),
  setSimulationControlSpeed: inputHandler({
    args: {
      speed: v.union(v.literal(1), v.literal(4), v.literal(16)),
    },
    handler: (game, now, { speed }) => {
      const control = game.world.simulationControl;
      if (control) {
        control.elapsedSimulationMs = simulationElapsedMs(control, now);
        control.lastSpeedChangedAt = now;
        control.speed = speed;
      }
      return null;
    },
  }),
};
