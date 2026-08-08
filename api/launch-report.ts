import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ConvexReportRepository } from './_lib/convexReportRepository';
import type { ReportArtifact } from '../src/launchReport/report';

const requestSchema = z.object({
  productId: z.string().min(1).max(128),
  format: z.enum(['json', 'pdf']).default('json'),
});

export const maxDuration = 300;

interface ApiRequest {
  method?: string;
  body?: unknown;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  send(body: Buffer): void;
  setHeader(name: string, value: string): void;
  end(): void;
}

async function sendPdf(
  response: ApiResponse,
  repository: ConvexReportRepository,
  productId: string,
  artifact: ReportArtifact,
) {
  const { renderLaunchReportPdf } = await import('../src/launchReport/pdf');
  const [simulationRun, browserRuns, residentStates, influenceEvents] = await Promise.all([
    repository.getSimulationRun(productId),
    repository.getBrowserRuns(productId),
    repository.getResidentStates(productId),
    repository.getInfluenceEvents(productId),
  ]);
  if (!simulationRun) throw new Error('Completed simulation evidence is unavailable');
  const pdf = await renderLaunchReportPdf(artifact, {
    simulationRun,
    browserRuns,
    residentStates,
    influenceEvents,
  });
  const filename = artifact.productName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}-launch-report.pdf"`);
  response.setHeader('Content-Length', String(pdf.length));
  response.status(200).send(pdf);
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    response.status(503).json({ error: 'Launch Report is not configured' });
    return;
  }
  const convexUrl = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
  const gateSecret = process.env.LAUNCH_REPORT_GATE_SECRET;
  if (!convexUrl || !gateSecret) {
    response.status(503).json({ error: 'LaunchTown data service is not configured' });
    return;
  }

  try {
    const { productId, format } = requestSchema.parse(request.body);
    const { createConvexReportRepository } = await import('./_lib/convexReportRepository');
    const repository = createConvexReportRepository(convexUrl, gateSecret);
    const leaseId = randomUUID();
    const claim = await repository.beginReportGeneration(productId, leaseId);
    if (claim.state === 'complete') {
      if (format === 'pdf') {
        await sendPdf(response, repository, productId, claim.artifact);
      } else {
        response.status(200).json(claim.artifact);
      }
      return;
    }
    if (claim.state === 'not_found') {
      response.status(404).json({ error: 'Product not found' });
      return;
    }
    if (claim.state === 'not_ready') {
      response.status(409).json({ error: 'Complete the simulation before generating a report' });
      return;
    }
    if (claim.state === 'running') {
      response.status(409).json({ error: 'A Launch Report is already being generated' });
      return;
    }
    if (claim.state === 'exhausted') {
      response.status(429).json({ error: 'The Launch Report retry limit has been reached' });
      return;
    }

    const [{ createReportToolHandlers }, { createClaudeReportAgent }, { generateReportArtifact }] =
      await Promise.all([
        import('./_lib/reportTools'),
        import('./_lib/claudeReportAgent'),
        import('../src/launchReport/report'),
      ]);
    const tools = createReportToolHandlers(repository, productId);
    const agent = createClaudeReportAgent(tools, productId);
    try {
      const artifact = await generateReportArtifact(agent);
      await repository.completeReportGeneration(productId, leaseId, artifact);
      if (format === 'pdf') {
        await sendPdf(response, repository, productId, artifact);
      } else {
        response.status(200).json(artifact);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate report';
      await repository.failReportGeneration(productId, leaseId, message).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate report';
    response.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
}
