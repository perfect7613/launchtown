export interface SimulationStartSteps {
  beginRun: () => Promise<void>;
  runBrowserJourneys: () => Promise<void>;
  startConversations: () => Promise<void>;
  startLocalClock: () => void;
}

export async function startSimulationInOrder(steps: SimulationStartSteps): Promise<void> {
  await steps.beginRun();
  await steps.runBrowserJourneys();
  await steps.startConversations();
  steps.startLocalClock();
}
