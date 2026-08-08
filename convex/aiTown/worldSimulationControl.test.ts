import { type SerializedWorld, World } from './world';

test('round trips every field currently persisted in live simulation control state', () => {
  const simulationControl: NonNullable<SerializedWorld['simulationControl']> = {
    conversationStarts: 4,
    elapsedSimulationMs: 240_000,
    lastSpeedChangedAt: 1_786_179_736_331,
    participantIds: ['p:0', 'p:2'],
    speed: 16,
    startedAt: 1_786_179_700_000,
  };
  const world = new World({
    nextId: 3,
    conversations: [],
    players: [],
    agents: [],
    simulationControl,
  });

  expect(world.serialize().simulationControl).toEqual(simulationControl);
});

test('round trips legacy simulation control state without optional timing fields', () => {
  const simulationControl: NonNullable<SerializedWorld['simulationControl']> = {
    conversationStarts: 1,
    participantIds: ['p:0', 'p:2'],
    speed: 4,
    startedAt: 1_786_179_700_000,
  };
  const world = new World({
    nextId: 3,
    conversations: [],
    players: [],
    agents: [],
    simulationControl,
  });

  expect(world.serialize().simulationControl).toEqual(simulationControl);
});
