import { World } from './world';

test('round trips every field currently persisted in live simulation control state', () => {
  const simulationControl = {
    conversationStarts: 4,
    elapsedSimulationMs: 240_000,
    lastSpeedChangedAt: 1_786_179_736_331,
    participantIds: ['p:0', 'p:2'] as never[],
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
