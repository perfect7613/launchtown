import {
  generateReportArtifact,
  reportToMarkdown,
  type LaunchReport,
  type ReportAgent,
} from './report';

const claudeResponse: LaunchReport = {
  productName: 'Ledgerly',
  productUrl: 'https://ledgerly.example',
  executiveSummary: 'Trust collapsed at the premature bank-connection boundary.',
  topFrictions: [
    {
      title: 'Premature bank connection',
      severity: 'high',
      residents: ['Priya'],
      evidence: ['Priya postponed when signup requested bank access.'],
    },
  ],
  beliefSpread: [
    {
      belief: 'Ledgerly asks for bank access too early',
      source: 'Priya',
      listeners: [
        {
          resident: 'Rohan',
          evidence: 'Rohan inherited Priya’s warning.',
          behaviorChange: 'Visited security first.',
        },
      ],
    },
  ],
  funnelOutcomes: [
    {
      resident: 'Priya',
      stage: 'evaluating',
      outcome: 'Postponed signup',
      pagesVisited: ['/', '/signup'],
      converted: false,
      evidence: 'Completed browser journey.',
    },
  ],
  recommendations: [
    {
      title: 'Delay bank access',
      priority: 'P0',
      fix: 'Move bank connection until after the value preview.',
      rationale: 'The current request arrives before trust is established.',
      evidence: ['Priya abandoned at this exact boundary.'],
    },
    {
      title: 'Front-load security proof',
      priority: 'P1',
      fix: 'Place security assurances beside the primary CTA.',
      rationale: 'Security became the next resident’s first investigation.',
      evidence: ['Rohan visited /security first.'],
    },
    {
      title: 'Explain data access',
      priority: 'P1',
      fix: 'Explain permissions before asking for consent.',
      rationale: 'Residents interpreted the unexplained request as risky.',
      evidence: ['The bank-access belief spread socially.'],
    },
  ],
};

test('assembles a validated markdown artifact from a mocked Claude response', async () => {
  const agent: ReportAgent = {
    run: async () => ({ sessionId: 'session-123', output: claudeResponse }),
  };

  const artifact = await generateReportArtifact(agent, () => new Date('2026-08-08T10:00:00Z'));

  expect(artifact.sessionId).toBe('session-123');
  expect(artifact.generatedAt).toBe('2026-08-08T10:00:00.000Z');
  expect(artifact.markdown).toContain('# Launch Report: Ledgerly');
  expect(artifact.markdown).toContain('Priya → Rohan');
  expect(artifact.markdown).toContain('## Recommended site fixes');
  expect(artifact.recommendations).toHaveLength(3);
});

test('rejects a mocked Claude response that omits required evidence', async () => {
  const agent: ReportAgent = {
    run: async () => ({
      sessionId: 'session-invalid',
      output: {
        ...claudeResponse,
        recommendations: claudeResponse.recommendations.map((recommendation, index) =>
          index === 0 ? { ...recommendation, evidence: [] } : recommendation,
        ),
      },
    }),
  };

  await expect(generateReportArtifact(agent)).rejects.toThrow();
});

test('keeps Markdown funnel values inside one escaped table row', () => {
  const markdown = reportToMarkdown({
    ...claudeResponse,
    funnelOutcomes: [
      {
        ...claudeResponse.funnelOutcomes[0],
        resident: 'Priya | Founder',
        outcome: 'Paused\nfor review',
        pagesVisited: ['/pricing|annual', '/signup\nconfirm'],
      },
    ],
  });

  expect(markdown).toContain(
    '| Priya \\| Founder | evaluating | No | Paused<br>for review | /pricing\\|annual → /signup<br>confirm |',
  );
});
