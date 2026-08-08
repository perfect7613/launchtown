import { z } from 'zod';
import { createClaudeReportAgent } from './_lib/claudeReportAgent';
import { createConvexReportRepository } from './_lib/convexReportRepository';
import { createReportToolHandlers } from './_lib/reportTools';
import { generateReportArtifact } from '../src/launchReport/report';

const requestSchema = z.object({ productId: z.string().min(1).max(128) });

export const maxDuration = 300;

interface ApiRequest {
  method?: string;
  body?: unknown;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  end(): void;
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
  if (!convexUrl) {
    response.status(503).json({ error: 'LaunchTown data service is not configured' });
    return;
  }

  try {
    const { productId } = requestSchema.parse(request.body);
    const repository = createConvexReportRepository(convexUrl);
    const tools = createReportToolHandlers(repository, productId);
    const agent = createClaudeReportAgent(tools, productId);
    response.status(200).json(await generateReportArtifact(agent));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate report';
    response.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
}
