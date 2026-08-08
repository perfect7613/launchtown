import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import type { ReportRepository } from './reportTools';

const getInfluenceEvents = makeFunctionReference<'query'>(
  'launchTown/reportData:getInfluenceEvents',
);
const getBrowserRuns = makeFunctionReference<'query'>('launchTown/reportData:getBrowserRuns');
const getResidentStates = makeFunctionReference<'query'>('launchTown/reportData:getResidentStates');
const getMemories = makeFunctionReference<'query'>('launchTown/reportData:getMemories');

export function createConvexReportRepository(convexUrl: string): ReportRepository {
  const client = new ConvexHttpClient(convexUrl);
  return {
    getInfluenceEvents: (productId) => client.query(getInfluenceEvents, { productId }),
    getBrowserRuns: (productId) => client.query(getBrowserRuns, { productId }),
    getResidentStates: (productId) => client.query(getResidentStates, { productId }),
    getMemories: (productId) => client.query(getMemories, { productId }),
  };
}
