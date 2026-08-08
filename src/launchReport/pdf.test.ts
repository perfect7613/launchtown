import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReportArtifact } from './report';
import { renderLaunchReportPdf, sanitizeReportText } from './pdf';

const artifact: ReportArtifact = {
  productName: 'Maya Research',
  productUrl: 'https://maya.example/research?token=do-not-keep',
  executiveSummary: 'Researchers understood the promise but wanted clearer proof and pricing.',
  topFrictions: [
    {
      title: 'Evidence arrives too late',
      severity: 'high',
      residents: ['Asha', 'Ben'],
      evidence: ['Asha looked for methodology before starting a trial.'],
    },
  ],
  beliefSpread: [
    {
      belief: 'Methodology should be visible before signup',
      source: 'asha',
      listeners: [
        { resident: 'ben', evidence: 'Peer warning persisted', behaviorChange: 'Reviewed proof' },
      ],
    },
  ],
  funnelOutcomes: [],
  recommendations: [
    {
      title: 'Show the methodology',
      priority: 'P0',
      fix: 'Add a concise methodology module beside the primary CTA.',
      rationale: 'Trust evidence was the most common unmet need.',
      evidence: ['Asha sought proof.'],
    },
    {
      title: 'Clarify pricing',
      priority: 'P1',
      fix: 'State the billing unit before signup.',
      rationale: 'Price uncertainty slowed evaluation.',
      evidence: ['Ben compared plans.'],
    },
    {
      title: 'Add customer proof',
      priority: 'P1',
      fix: 'Place a relevant case study near the CTA.',
      rationale: 'Personas needed credible outcomes.',
      evidence: ['Asha looked for references.'],
    },
  ],
  sessionId: 'claude-session-safe',
  generatedAt: '2026-08-08T10:00:00.000Z',
  markdown: '# fixture',
};

const personaKeys = ['asha', 'ben', 'cora', 'dev', 'emi', 'finn', 'gia', 'hari'];
const conversationEvidence = [
  { speaker: 'asha', peer: 'ben' },
  { speaker: 'cora', peer: 'dev' },
  { speaker: 'emi', peer: 'finn' },
  { speaker: 'gia', peer: 'hari' },
];

test('sanitizes phone numbers, secrets, and browser connection endpoints', () => {
  const unsafe =
    'Call +1 (415) 555-0123 token=secret-value https://connect.browserbase.com/session?id=debug';
  const safe = sanitizeReportText(unsafe);
  expect(safe).toContain('[redacted phone]');
  expect(safe).toContain('token: [redacted]');
  expect(safe).toContain('[redacted browser endpoint]');
  expect(safe).not.toContain('555-0123');
  expect(safe).not.toContain('connect.browserbase.com');
});

test('renders a gated, run-scoped PDF with persona, conversation, and browser evidence', async () => {
  const pdf = await renderLaunchReportPdf(artifact, {
    simulationRun: {
      runId: 'run-maya-20260808',
      status: 'completed',
      speed: 16,
      coveredPersonaKeys: personaKeys,
      conversationEvidence,
      startedAt: Date.parse('2026-08-08T09:58:00Z'),
      simulationCompletedAt: Date.parse('2026-08-08T09:58:35Z'),
      completedAt: Date.parse('2026-08-08T10:00:00Z'),
    },
    residentStates: {
      product: { productModel: { category: 'AI research platform' } },
      residents: personaKeys.map((residentKey) => ({
        residentKey,
        name: residentKey[0].toUpperCase() + residentKey.slice(1),
        state: { trust: 0.62, purchaseIntent: 0.48 },
      })),
    },
    browserRuns: personaKeys.map((residentKey, index) => ({
      residentKey,
      source: 'live',
      status: 'completed',
      sessionId: `bb-session-${index + 1}`,
      sessionStatus: 'COMPLETED',
      result: {
        outcome: `${residentKey} completed an evidence review.`,
        pagesVisited: ['/', '/methodology'],
        frictions: ['Proof was hard to find.'],
        trustDelta: 0.08,
        intentDelta: 0.05,
      },
    })),
    influenceEvents: [
      {
        speaker: 'asha',
        listener: 'ben',
        appliedDeltas: { trust: 0.04, purchaseIntent: 0.02 },
        behavioralSuggestion: 'Review methodology',
      },
    ],
  });

  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(10_000);
  const outputDir = resolve(process.cwd(), 'tmp/pdfs');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, 'maya-research-representative.pdf'), pdf);
});
