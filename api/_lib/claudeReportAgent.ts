import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  launchReportSchema,
  type ReportAgent,
  type ReportAgentResult,
} from '../../src/launchReport/report';
import type { ReportToolHandlers } from './reportTools';

const TOOL_NAMES = [
  'get_influence_events',
  'get_browser_runs',
  'get_resident_states',
  'get_memories',
] as const;

function toolResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
}

export function createClaudeReportAgent(
  handlers: ReportToolHandlers,
  productId: string,
): ReportAgent {
  return {
    async run(): Promise<ReportAgentResult> {
      let final: ReportAgentResult | undefined;
      const usedTools = new Set<string>();
      const trackedTool =
        (name: (typeof TOOL_NAMES)[number], handler: () => Promise<unknown>) => async () => {
          const value = await handler();
          usedTools.add(name);
          return toolResult(value);
        };
      const evidenceServer = createSdkMcpServer({
        name: 'launchtown',
        version: '1.0.0',
        instructions:
          'These tools are read-only views of the mounted LaunchTown simulation. Cite only evidence returned by them.',
        alwaysLoad: true,
        tools: [
          tool(
            'get_influence_events',
            'Read belief transfers, social influence deltas, and behavior triggers.',
            {},
            trackedTool('get_influence_events', handlers.get_influence_events),
          ),
          tool(
            'get_browser_runs',
            'Read resident browser journeys, frictions, pages, and outcomes. Credentials are excluded.',
            {},
            trackedTool('get_browser_runs', handlers.get_browser_runs),
          ),
          tool(
            'get_resident_states',
            'Read mounted product context, resident traits, final beliefs, and funnel states.',
            {},
            trackedTool('get_resident_states', handlers.get_resident_states),
          ),
          tool(
            'get_memories',
            'Read resident first-hand product experiences and product hearsay.',
            {},
            trackedTool('get_memories', handlers.get_memories),
          ),
        ],
      });
      const allowedTools = TOOL_NAMES.map((name) => `mcp__launchtown__${name}`);
      for await (const message of query({
        prompt: `Generate the founder-facing launch report for the mounted product ${productId}.

Call all four LaunchTown tools. Reconcile the evidence across them. Identify concrete frictions with named residents and evidence; trace each transferred belief from source through listeners to behavior change; include a funnel outcome for every resident; then recommend exactly three specific website fixes. Do not invent missing observations, conversions, or causal links. Prefer observed browser evidence over inference and label unknown outcomes plainly.`,
        options: {
          model: process.env.LAUNCH_REPORT_MODEL ?? 'claude-sonnet-4-6',
          cwd: process.env.VERCEL ? '/tmp' : process.cwd(),
          systemPrompt:
            "You are LaunchTown's launch analyst. You inspect a mounted, immutable simulation snapshot through service-owned read-only tools. Claude interprets evidence but never writes simulation state.",
          mcpServers: { launchtown: evidenceServer },
          tools: [],
          allowedTools,
          strictMcpConfig: true,
          permissionMode: 'dontAsk',
          settingSources: [],
          maxTurns: 10,
          maxBudgetUsd: 1,
          outputFormat: {
            type: 'json_schema',
            schema: z.toJSONSchema(launchReportSchema, { target: 'draft-7' }),
          },
          env: {
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
            PATH: process.env.PATH,
            TMPDIR: process.env.TMPDIR,
            TEMP: process.env.TEMP,
            TMP: process.env.TMP,
            CLAUDE_AGENT_SDK_CLIENT_APP: 'launchtown-launch-report/1.0.0',
            CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
            CLAUDE_CONFIG_DIR: '/tmp/launchtown-launch-report-claude',
          },
        },
      })) {
        if (message.type !== 'result') continue;
        if (message.subtype !== 'success') {
          throw new Error(message.errors.join('; ') || `Claude session failed: ${message.subtype}`);
        }
        final = {
          sessionId: message.session_id,
          output: message.structured_output,
        };
      }
      if (!final) throw new Error('Claude session ended without a structured report');
      const missingTools = TOOL_NAMES.filter((name) => !usedTools.has(name));
      if (missingTools.length > 0) {
        throw new Error(
          `Claude report omitted required evidence tools: ${missingTools.join(', ')}`,
        );
      }
      return final;
    },
  };
}
