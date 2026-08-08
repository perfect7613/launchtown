import { startSimulationInOrder } from './simulationStartOrder';

test('persists terminal browser evidence before starting persona conversations', async () => {
  const events: string[] = [];

  await startSimulationInOrder({
    beginRun: async () => {
      events.push('run-created');
    },
    runBrowserJourneys: async () => {
      events.push('browser-runs-terminal-and-persisted');
    },
    startConversations: async () => {
      events.push('conversations-started');
    },
    startLocalClock: () => {
      events.push('simulation-clock-started');
    },
  });

  expect(events).toEqual([
    'run-created',
    'browser-runs-terminal-and-persisted',
    'conversations-started',
    'simulation-clock-started',
  ]);

  const eventsAfterBrowserFailure: string[] = [];
  await expect(
    startSimulationInOrder({
      beginRun: async () => undefined,
      runBrowserJourneys: async () => {
        throw new Error('browser phase failed');
      },
      startConversations: async () => {
        eventsAfterBrowserFailure.push('conversations-started');
      },
      startLocalClock: () => {
        eventsAfterBrowserFailure.push('simulation-clock-started');
      },
    }),
  ).rejects.toThrow('browser phase failed');
  expect(eventsAfterBrowserFailure).toEqual([]);
});
