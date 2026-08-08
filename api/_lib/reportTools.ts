export interface ReportRepository {
  getInfluenceEvents(productId: string): Promise<unknown>;
  getBrowserRuns(productId: string): Promise<unknown>;
  getResidentStates(productId: string): Promise<unknown>;
  getMemories(productId: string): Promise<unknown>;
}

export interface ReportToolHandlers {
  get_influence_events(): Promise<unknown>;
  get_browser_runs(): Promise<unknown>;
  get_resident_states(): Promise<unknown>;
  get_memories(): Promise<unknown>;
}

/**
 * Mounts a single product into the session. Tool arguments cannot select a
 * different product and the repository contract contains no write operation.
 */
export function createReportToolHandlers(
  repository: ReportRepository,
  productId: string,
): ReportToolHandlers {
  return {
    get_influence_events: () => repository.getInfluenceEvents(productId),
    get_browser_runs: () => repository.getBrowserRuns(productId),
    get_resident_states: () => repository.getResidentStates(productId),
    get_memories: () => repository.getMemories(productId),
  };
}
