import {
  MAX_SIMULATION_CONVERSATIONS,
  SIMULATION_DURATION_MS,
  conversationPolicy,
  personaConversationPairs,
  simulationElapsedMs,
  simulationIsComplete,
} from './simulationControl';
import { World } from './world';
import type { SerializedWorld } from './world';

describe('simulation speed policy', () => {
  test('16x completes the eight-minute simulation in under one minute', () => {
    expect(SIMULATION_DURATION_MS / 16).toBe(30_000);
  });

  test('speed controls conversation depth without increasing the conversation count', () => {
    expect(conversationPolicy(16)).toEqual({ maxDurationMs: 20_000, maxMessages: 4 });
    expect(conversationPolicy(4)).toEqual({ maxDurationMs: 45_000, maxMessages: 6 });
    expect(conversationPolicy(1)).toEqual({ maxDurationMs: 120_000, maxMessages: 8 });
    expect(MAX_SIMULATION_CONVERSATIONS).toBe(4);
  });

  test('speed changes preserve elapsed simulation time and share the terminal boundary', () => {
    const control = {
      speed: 4 as const,
      startedAt: 1_000,
      elapsedSimulationMs: 120_000,
      lastSpeedChangedAt: 10_000,
      conversationStarts: 2,
      participantIds: ['p:0', 'p:2'],
    };
    expect(simulationElapsedMs(control, 20_000)).toBe(160_000);
    expect(simulationIsComplete(control, 99_999)).toBe(false);
    expect(simulationIsComplete(control, 100_000)).toBe(true);
  });

  test('four deterministic pairs cover all eight personas without requiring every pair', () => {
    const personaIds = ['p:8', 'p:0', 'p:6', 'p:2', 'p:14', 'p:4', 'p:12', 'p:10'];
    const pairs = personaConversationPairs(personaIds);
    expect(pairs).toHaveLength(4);
    expect(new Set(pairs.flat())).toEqual(new Set(personaIds));
  });

  test('odd persona counts are covered by one repeated peer', () => {
    const pairs = personaConversationPairs(['p:2', 'p:0', 'p:1']);
    expect(pairs).toEqual([
      ['p:0', 'p:1'],
      ['p:2', 'p:0'],
    ]);
  });

  test('the full live simulation control shape survives a world round trip', () => {
    const simulationControl: NonNullable<SerializedWorld['simulationControl']> = {
      runId: 'run-live-shape',
      speed: 16 as const,
      startedAt: 1_000,
      elapsedSimulationMs: 240_000,
      lastSpeedChangedAt: 2_000,
      conversationStarts: 4,
      participantIds: ['p:0', 'p:2'],
      conversationPairs: [{ speakerId: 'p:0', peerId: 'p:2' }],
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
});
