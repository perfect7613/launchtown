import { World, type SerializedWorld } from './world';

test('preserves the deployed simulation control state when serializing a world', () => {
  const serialized: SerializedWorld = {
    nextId: 1,
    conversations: [],
    players: [],
    agents: [],
    simulationControl: {
      conversationStarts: 2,
      elapsedSimulationMs: 12_000,
      lastSpeedChangedAt: 1_786_179_299_499,
      participantIds: ['p:0', 'p:2'],
      speed: 16,
      startedAt: 1_786_179_287_499,
    },
  };

  expect(new World(serialized).serialize()).toEqual(serialized);
});
