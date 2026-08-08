import { createReportToolHandlers, type ReportRepository } from './reportTools';

test('exposes the four mounted read-only evidence views', async () => {
  const productId = 'products:ledgerly';
  const repository: ReportRepository = {
    getInfluenceEvents: async (id) => [{ id, listener: 'rohan' }],
    getBrowserRuns: async (id) => [{ id, residentKey: 'priya' }],
    getResidentStates: async (id) => ({ id, residents: ['priya', 'rohan'] }),
    getMemories: async (id) => [{ id, type: 'productExperience' }],
    getSimulationRun: async (id) => ({ id, status: 'completed' }),
  };
  const tools = createReportToolHandlers(repository, productId);

  await expect(tools.get_influence_events()).resolves.toEqual([
    { id: productId, listener: 'rohan' },
  ]);
  await expect(tools.get_browser_runs()).resolves.toEqual([
    { id: productId, residentKey: 'priya' },
  ]);
  await expect(tools.get_resident_states()).resolves.toEqual({
    id: productId,
    residents: ['priya', 'rohan'],
  });
  await expect(tools.get_memories()).resolves.toEqual([
    { id: productId, type: 'productExperience' },
  ]);
  expect(Object.keys(tools).sort()).toEqual([
    'get_browser_runs',
    'get_influence_events',
    'get_memories',
    'get_resident_states',
  ]);
});
