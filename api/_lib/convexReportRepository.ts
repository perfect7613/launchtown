import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import type { ReportArtifact } from '../../src/launchReport/report';
import type { ReportRepository } from './reportTools';

const getInfluenceEvents = makeFunctionReference<'query'>(
  'launchTown/reportData:getInfluenceEvents',
);
const getBrowserRuns = makeFunctionReference<'query'>('launchTown/reportData:getBrowserRuns');
const getResidentStates = makeFunctionReference<'query'>('launchTown/reportData:getResidentStates');
const getMemories = makeFunctionReference<'query'>('launchTown/reportData:getMemories');
const getSimulationRun = makeFunctionReference<'query'>('launchTown/reportData:getSimulationRun');
const beginReportGeneration = makeFunctionReference<'mutation'>(
  'launchTown/reportGeneration:begin',
);
const completeReportGeneration = makeFunctionReference<'mutation'>(
  'launchTown/reportGeneration:complete',
);
const failReportGeneration = makeFunctionReference<'mutation'>('launchTown/reportGeneration:fail');

export type ReportGenerationClaim =
  | { state: 'granted' }
  | { state: 'running' }
  | { state: 'exhausted' }
  | { state: 'not_found' }
  | { state: 'not_ready' }
  | { state: 'complete'; artifact: ReportArtifact };

export interface ConvexReportRepository extends ReportRepository {
  beginReportGeneration(productId: string, leaseId: string): Promise<ReportGenerationClaim>;
  completeReportGeneration(
    productId: string,
    leaseId: string,
    artifact: ReportArtifact,
  ): Promise<void>;
  failReportGeneration(productId: string, leaseId: string, error: string): Promise<void>;
}

export function createConvexReportRepository(
  convexUrl: string,
  gateSecret: string,
): ConvexReportRepository {
  const client = new ConvexHttpClient(convexUrl);
  return {
    getInfluenceEvents: (productId) => client.query(getInfluenceEvents, { productId }),
    getBrowserRuns: (productId) => client.query(getBrowserRuns, { productId }),
    getResidentStates: (productId) => client.query(getResidentStates, { productId }),
    getMemories: (productId) => client.query(getMemories, { productId }),
    getSimulationRun: (productId) => client.query(getSimulationRun, { productId }),
    beginReportGeneration: (productId, leaseId) =>
      client.mutation(beginReportGeneration, { productId, leaseId, gateSecret }),
    completeReportGeneration: async (productId, leaseId, artifact) => {
      await client.mutation(completeReportGeneration, {
        productId,
        leaseId,
        artifact,
        gateSecret,
      });
    },
    failReportGeneration: async (productId, leaseId, error) => {
      await client.mutation(failReportGeneration, { productId, leaseId, error, gateSecret });
    },
  };
}
