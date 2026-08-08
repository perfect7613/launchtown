import { z } from 'zod';

export const launchReportSchema = z.object({
  productName: z.string().min(1),
  productUrl: z.string().min(1),
  executiveSummary: z.string().min(1),
  topFrictions: z.array(
    z.object({
      title: z.string().min(1),
      severity: z.enum(['high', 'medium', 'low']),
      residents: z.array(z.string().min(1)).min(1),
      evidence: z.array(z.string().min(1)).min(1),
    }),
  ),
  beliefSpread: z.array(
    z.object({
      belief: z.string().min(1),
      source: z.string().min(1),
      listeners: z.array(
        z.object({
          resident: z.string().min(1),
          evidence: z.string().min(1),
          behaviorChange: z.string().min(1),
        }),
      ),
    }),
  ),
  funnelOutcomes: z.array(
    z.object({
      resident: z.string().min(1),
      stage: z.string().min(1),
      outcome: z.string().min(1),
      pagesVisited: z.array(z.string()),
      converted: z.boolean(),
      evidence: z.string().min(1),
    }),
  ),
  recommendations: z
    .array(
      z.object({
        title: z.string().min(1),
        priority: z.enum(['P0', 'P1', 'P2']),
        fix: z.string().min(1),
        rationale: z.string().min(1),
        evidence: z.array(z.string().min(1)).min(1),
      }),
    )
    .length(3),
});

export type LaunchReport = z.infer<typeof launchReportSchema>;

export interface ReportArtifact extends LaunchReport {
  sessionId: string;
  generatedAt: string;
  markdown: string;
}

export interface ReportAgentResult {
  sessionId: string;
  output: unknown;
}

export interface ReportAgent {
  run(): Promise<ReportAgentResult>;
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

function markdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

export function reportToMarkdown(report: LaunchReport): string {
  const frictions = report.topFrictions
    .map(
      (friction) =>
        `### ${friction.title} (${friction.severity})\n\nResidents: ${friction.residents.join(', ')}\n\n${bulletList(
          friction.evidence,
        )}`,
    )
    .join('\n\n');
  const spread = report.beliefSpread
    .map(
      (item) =>
        `### ${item.belief}\n\nSource: ${item.source} → ${
          item.listeners.map((listener) => listener.resident).join(', ') || 'no listeners'
        }\n\n${item.listeners
          .map(
            (listener) =>
              `- **${listener.resident}:** ${listener.evidence} → ${listener.behaviorChange}`,
          )
          .join('\n')}`,
    )
    .join('\n\n');
  const funnel = report.funnelOutcomes
    .map(
      (resident) =>
        `| ${markdownTableCell(resident.resident)} | ${markdownTableCell(resident.stage)} | ${resident.converted ? 'Yes' : 'No'} | ${markdownTableCell(resident.outcome)} | ${markdownTableCell(resident.pagesVisited.join(' → ') || '—')} |`,
    )
    .join('\n');
  const recommendations = report.recommendations
    .map(
      (recommendation, index) =>
        `### ${index + 1}. ${recommendation.title} (${recommendation.priority})\n\n${recommendation.fix}\n\n**Why:** ${recommendation.rationale}\n\n${bulletList(
          recommendation.evidence,
        )}`,
    )
    .join('\n\n');

  return `# Launch Report: ${report.productName}\n\n${report.productUrl}\n\n## Executive summary\n\n${report.executiveSummary}\n\n## Top frictions\n\n${frictions || 'No evidenced frictions.'}\n\n## How beliefs spread\n\n${spread || 'No belief transfers were observed.'}\n\n## Funnel outcomes by resident\n\n| Resident | Final stage | Converted | Outcome | Pages visited |\n| --- | --- | --- | --- | --- |\n${funnel}\n\n## Recommended site fixes\n\n${recommendations}\n`;
}

export async function generateReportArtifact(
  agent: ReportAgent,
  now: () => Date = () => new Date(),
): Promise<ReportArtifact> {
  const result = await agent.run();
  const report = launchReportSchema.parse(result.output);
  return {
    ...report,
    sessionId: result.sessionId,
    generatedAt: now().toISOString(),
    markdown: reportToMarkdown(report),
  };
}
