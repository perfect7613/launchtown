import PDFDocument from 'pdfkit';
import type { ReportArtifact } from './report';

export interface PdfReportEvidence {
  simulationRun: unknown;
  browserRuns: unknown;
  residentStates: unknown;
  influenceEvents: unknown;
}

type UnknownRecord = Record<string, unknown>;

const COLORS = {
  ink: '#172235',
  muted: '#657287',
  navy: '#11233f',
  blue: '#2d6cdf',
  cyan: '#eaf3ff',
  line: '#dbe3ee',
  paper: '#ffffff',
  warning: '#a15c00',
  success: '#13795b',
};

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function records(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Remove high-risk values before any untrusted report text reaches the PDF. */
export function sanitizeReportText(value: unknown): string {
  let text = String(value ?? '');
  text = text.replace(/https?:\/\/[^\s<>()]+/gi, (urlText) => {
    try {
      const url = new URL(urlText.replace(/[.,;:!?]+$/, ''));
      if (/connect|debug/i.test(url.hostname) || /connect|debug/i.test(url.pathname)) {
        return '[redacted browser endpoint]';
      }
      return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
      return '[redacted URL]';
    }
  });
  text = text.replace(/\b(?:sk|pk|rk|api)[-_][a-z0-9_-]{12,}\b/gi, '[redacted secret]');
  text = text.replace(/\bBearer\s+[a-z0-9._~+\/-]{12,}\b/gi, 'Bearer [redacted]');
  text = text.replace(
    /\b(api[_ -]?key|secret|password|token)\s*[:=]\s*\S+/gi,
    '$1: [redacted]',
  );
  text = text.replace(
    /(?<![\d-])(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,4}\)|\d{2,4})[ .-]?\d{3,4}[ .-]\d{4}(?![\d-])|(?<![\d-])\+?\d{10,15}(?![\d-])/g,
    '[redacted phone]',
  );
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
}

function text(value: unknown, fallback = 'Not observed'): string {
  const sanitized = sanitizeReportText(value);
  return sanitized || fallback;
}

function formatTime(value: unknown): string {
  const timestamp = safeNumber(value);
  if (!timestamp) return 'Not recorded';
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf()) ? 'Not recorded' : date.toISOString();
}

function formatDelta(value: unknown): string {
  const delta = safeNumber(value);
  if (delta === undefined) return 'n/a';
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`;
}

function truncate(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, Math.max(0, length - 3))}...`;
}

function collectPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

export async function renderLaunchReportPdf(
  artifact: ReportArtifact,
  evidence: PdfReportEvidence,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 54, right: 52, bottom: 62, left: 52 },
    bufferPages: true,
    info: {
      Title: `Launch Report - ${sanitizeReportText(artifact.productName)}`,
      Author: 'LaunchTown',
      Subject: 'Completed simulation evidence report',
    },
  });
  const completed = collectPdf(doc);
  const run = record(evidence.simulationRun);
  const stateRoot = record(evidence.residentStates);
  const product = record(stateRoot.product);
  const productModel = record(product.productModel);
  const residents = records(stateRoot.residents);
  const browserRuns = records(evidence.browserRuns);
  const influenceEvents = records(evidence.influenceEvents);
  const conversationEvidence = records(run.conversationEvidence);
  const runId = text(run.runId, 'Unavailable');
  const category = text(productModel.category, 'Unclassified');
  const pageBottom = 688;

  const ensureSpace = (height: number) => {
    if (doc.y + height > pageBottom) doc.addPage();
  };
  const section = (title: string, eyebrow?: string) => {
    ensureSpace(96);
    doc.moveDown(0.45);
    if (eyebrow) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.blue).text(
        eyebrow.toUpperCase(),
        52,
        doc.y,
        { width: 508, characterSpacing: 1.1 },
      );
      doc.moveDown(0.35);
    }
    doc.font('Helvetica-Bold').fontSize(19).fillColor(COLORS.navy).text(
      sanitizeReportText(title),
      52,
      doc.y,
      { width: 508 },
    );
    doc.moveDown(0.35);
    doc.strokeColor(COLORS.line).lineWidth(1).moveTo(52, doc.y).lineTo(560, doc.y).stroke();
    doc.moveDown(0.8);
  };
  const paragraph = (value: unknown, options: PDFKit.Mixins.TextOptions = {}) => {
    const safeText = text(value);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.ink);
    const textOptions = {
      width: 508,
      lineGap: 3,
      ...options,
    };
    const height = doc.heightOfString(safeText, textOptions);
    ensureSpace(height + 10);
    const y = doc.y;
    doc.text(safeText, 52, y, textOptions);
    doc.y = y + height + 7;
  };
  const labelValue = (label: string, value: unknown) => {
    ensureSpace(30);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted).text(
      label.toUpperCase(),
      52,
      doc.y,
      { width: 508, characterSpacing: 0.8 },
    );
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.ink).text(text(value), 52, doc.y, {
      width: 508,
    });
    doc.moveDown(0.55);
  };
  const bullet = (value: unknown, color = COLORS.blue) => {
    const safeText = text(value);
    doc.font('Helvetica').fontSize(9.5);
    const height = doc.heightOfString(safeText, { width: 488, lineGap: 2.5 });
    ensureSpace(height + 10);
    const y = doc.y;
    doc.fillColor(color).circle(57, y + 5, 2.4).fill();
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.ink).text(safeText, 68, y, {
      width: 488,
      lineGap: 2.5,
    });
    doc.y = y + height + 6;
  };

  // Cover and executive summary.
  doc.rect(0, 0, 612, 220).fill(COLORS.navy);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#89b4ff').text('LAUNCHTOWN / PRODUCTION REPORT', 52, 52, {
    characterSpacing: 1.4,
  });
  doc.font('Helvetica-Bold').fontSize(34).fillColor(COLORS.paper).text('Launch Report', 52, 82);
  doc.font('Helvetica').fontSize(19).fillColor('#dce8fb').text(text(artifact.productName), 52, 132, {
    width: 500,
  });
  doc.font('Helvetica').fontSize(9).fillColor('#9fb2ce').text(`Run ${runId}`, 52, 181, { width: 500 });
  doc.y = 250;
  labelValue('Product / category', `${text(artifact.productName)} / ${category}`);
  labelValue('Product URL', artifact.productUrl);
  labelValue('Simulation', `${text(run.status)} at ${text(run.speed)}x`);
  labelValue('Generated', artifact.generatedAt);
  section('Executive summary', 'Decision brief');
  paragraph(artifact.executiveSummary);
  doc.roundedRect(52, doc.y + 4, 508, 64, 5).fill(COLORS.cyan);
  const calloutY = doc.y + 18;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.blue).text('COMPLETION GATE', 68, calloutY);
  doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.ink).text(
    `Report generated only after terminal simulation and browser phases. ${strings(run.coveredPersonaKeys).length} personas have persisted conversation coverage.`,
    68,
    calloutY + 17,
    { width: 470, lineGap: 2 },
  );
  doc.y += 84;

  // Persona coverage matrix.
  section('Persona coverage matrix', 'Coverage and browser evidence');
  const widths = [80, 92, 68, 118, 150];
  const headers = ['Persona', 'Conversation', 'Source', 'Session / status', 'Pages and finding'];
  const drawRow = (cells: string[], header = false) => {
    const font = header ? 'Helvetica-Bold' : 'Helvetica';
    const fontSize = header ? 8 : 7.6;
    doc.font(font).fontSize(fontSize);
    const heights = cells.map((cell, index) =>
      doc.heightOfString(cell, { width: widths[index] - 10, lineGap: 1.5 }),
    );
    const height = Math.max(header ? 26 : 38, ...heights.map((item) => item + 14));
    ensureSpace(height + 3);
    const rowY = doc.y;
    doc.rect(52, rowY, 508, height).fill(header ? COLORS.navy : '#f8fafc');
    let x = 52;
    cells.forEach((cell, index) => {
      doc
        .font(font)
        .fontSize(fontSize)
        .fillColor(header ? COLORS.paper : COLORS.ink)
        .text(cell, x + 5, rowY + 7, { width: widths[index] - 10, lineGap: 1.5 });
      x += widths[index];
      if (index < cells.length - 1) {
        doc.strokeColor(header ? '#345273' : COLORS.line).moveTo(x, rowY).lineTo(x, rowY + height).stroke();
      }
    });
    doc.y = rowY + height + 2;
  };
  drawRow(headers, true);
  const covered = new Set(strings(run.coveredPersonaKeys));
  for (const resident of residents) {
    const residentKey = text(resident.residentKey, text(resident.name));
    const residentName = text(resident.name, residentKey);
    const peers = conversationEvidence.flatMap((pair) => {
      const speaker = text(pair.speaker, '');
      const peer = text(pair.peer, '');
      if (speaker === residentKey) return [peer];
      if (peer === residentKey) return [speaker];
      return [];
    });
    const browser = browserRuns.find((candidate) => text(candidate.residentKey, '') === residentKey);
    const result = record(browser?.result);
    const pages = strings(result.pagesVisited).map((page) => text(page)).join(' > ');
    const finding = text(result.outcome, text(browser?.fallbackNotice, 'No completed finding'));
    drawRow([
      `${residentName}\n${covered.has(residentKey) ? 'Covered' : 'Missing'}`,
      peers.length > 0 ? `With ${peers.join(', ')}` : 'No peer evidence',
      text(browser?.source, 'error'),
      `${text(browser?.sessionId, 'No session')}\n${text(browser?.sessionStatus, text(browser?.status))}`,
      `${truncate(pages || 'No pages', 80)}\n${truncate(finding, 115)}`,
    ]);
  }

  // Persona findings and intent changes.
  ensureSpace(190);
  section('Website findings by persona', 'Isolated browser journeys');
  for (const resident of residents) {
    const residentKey = text(resident.residentKey, text(resident.name));
    const browser = browserRuns.find((candidate) => text(candidate.residentKey, '') === residentKey);
    const result = record(browser?.result);
    const state = record(resident.state);
    const name = text(resident.name, residentKey);
    const sessionLine = `${text(browser?.source, 'error')} source / ${text(browser?.sessionStatus, text(browser?.status))} / session ${text(browser?.sessionId, 'not created')}`;
    const outcome = truncate(
      text(result.outcome, text(browser?.fallbackNotice, 'No browser result')),
      220,
    );
    const pages = truncate(
      strings(result.pagesVisited).map((page) => text(page)).join(' > ') || 'None persisted',
      150,
    );
    const frictions = truncate(
      strings(result.frictions).map((item) => text(item)).join('; ') || 'None observed',
      220,
    );
    const deltas = `Trust ${formatDelta(result.trustDelta)} (final ${safeNumber(state.trust)?.toFixed(2) ?? 'n/a'}) / intent ${formatDelta(result.intentDelta)} (final ${safeNumber(state.purchaseIntent)?.toFixed(2) ?? 'n/a'})`;
    const cardHeight = 116;
    ensureSpace(cardHeight + 8);
    const cardY = doc.y;
    doc.roundedRect(52, cardY, 508, cardHeight, 4).fill('#f8fafc');
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.navy).text(name, 64, cardY + 9, {
      width: 484,
      height: 14,
      lineBreak: false,
      ellipsis: true,
    });
    doc.font('Helvetica').fontSize(7.7).fillColor(COLORS.muted).text(sessionLine, 64, cardY + 25, {
      width: 484,
      height: 11,
      lineBreak: false,
      ellipsis: true,
    });
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.ink).text(`Outcome: ${outcome}`, 64, cardY + 40, {
      width: 484,
      height: 20,
      ellipsis: true,
    });
    doc.text(`Pages: ${pages}`, 64, cardY + 61, {
      width: 484,
      height: 11,
      lineBreak: false,
      ellipsis: true,
    });
    doc.fillColor(COLORS.warning).text(`Frictions: ${frictions}`, 64, cardY + 75, {
      width: 484,
      height: 13,
      lineBreak: false,
      ellipsis: true,
    });
    doc.fillColor(COLORS.success).text(deltas, 64, cardY + 91, {
      width: 484,
      height: 13,
      lineBreak: false,
      ellipsis: true,
    });
    doc.y = cardY + cardHeight + 7;
  }

  // Conversation highlights only, never raw transcripts.
  section('Persona-to-persona conversation highlights', 'Persisted graph evidence');
  if (conversationEvidence.length === 0) bullet('No conversation edge evidence was persisted.', COLORS.warning);
  for (const pair of conversationEvidence) {
    bullet(`${text(pair.speaker)} spoke with ${text(pair.peer)} during the completed simulation.`);
  }
  for (const spread of artifact.beliefSpread) {
    const listeners = spread.listeners.map((listener) => listener.resident).join(', ');
    bullet(`“${text(spread.belief)}” moved from ${text(spread.source)} to ${text(listeners, 'no evidenced listener')}.`);
  }
  if (influenceEvents.length > 0) {
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.navy).text(
      'Observed trust and intent effects',
      52,
      doc.y,
      { width: 508 },
    );
    doc.moveDown(0.35);
    for (const event of influenceEvents.slice(0, 12)) {
      const deltas = record(event.appliedDeltas);
      bullet(
        `${text(event.speaker)} to ${text(event.listener)}: trust ${formatDelta(deltas.trust)}, intent ${formatDelta(deltas.purchaseIntent)}; ${text(event.behavioralSuggestion, 'no behavior change recorded')}`,
      );
    }
  }

  section('Key objections and frictions', 'Observed evidence');
  for (const friction of artifact.topFrictions) {
    ensureSpace(58);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.navy).text(
      `${text(friction.title)} / ${friction.severity.toUpperCase()}`,
      52,
      doc.y,
      { width: 508 },
    );
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted).text(
      `Personas: ${friction.residents.map((resident) => text(resident)).join(', ')}`,
      52,
      doc.y,
      { width: 508 },
    );
    doc.moveDown(0.3);
    friction.evidence.forEach((item) => bullet(item, COLORS.warning));
    doc.moveDown(0.35);
  }

  ensureSpace(220);
  section('Recommendations', 'Prioritized actions');
  artifact.recommendations.forEach((recommendation, index) => {
    ensureSpace(86);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.blue).text(
      `${index + 1} / ${recommendation.priority}`,
      52,
      doc.y,
      { width: 508 },
    );
    const title = text(recommendation.title);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.navy);
    const titleHeight = doc.heightOfString(title, { width: 508 });
    const titleY = doc.y;
    doc.text(
      title,
      52,
      titleY,
      { width: 508 },
    );
    doc.y = titleY + titleHeight + 3;
    paragraph(recommendation.fix);
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(COLORS.muted).text(
      text(recommendation.rationale),
      52,
      doc.y,
      { width: 508, lineGap: 2 },
    );
    doc.moveDown(0.65);
  });

  section('Methodology, timestamps, and caveats', 'Audit trail');
  labelValue('Run ID', runId);
  labelValue('Simulation started', formatTime(run.startedAt));
  labelValue('Simulation completed', formatTime(run.simulationCompletedAt));
  labelValue('All phases completed', formatTime(run.completedAt));
  labelValue('Report generated', artifact.generatedAt);
  paragraph(
    'Methodology: deterministic simulation lifecycle gating; persisted persona conversation graph validation; one isolated Browserbase session per persona with bounded concurrency; run-scoped evidence retrieval; and a structured analyst synthesis. The report excludes raw private transcripts, recordings, credentials, connect/debug URLs, and full phone numbers.',
  );
  bullet('Browser observations reflect the selected product as it appeared during this run and may change afterward.');
  bullet('Fallback or error sources are explicit in the persona matrix; they are not equivalent to a completed live session.', COLORS.warning);
  bullet('Conversation highlights summarize persisted evidence and model synthesis; no raw private transcript is included.');
  const fallbackRows = browserRuns.filter((browser) => text(browser.source, 'error') !== 'live');
  fallbackRows.forEach((browser) =>
    bullet(
      `${text(browser.residentKey)} caveat: ${text(browser.source, 'error')} - ${text(browser.fallbackNotice, text(browser.status))}`,
      COLORS.warning,
    ),
  );

  // Apply a stable header/footer after layout so page numbers are exact.
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.page.margins.bottom = 0;
    if (index > 0) {
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.muted).text(
        `LAUNCHTOWN / ${text(artifact.productName).toUpperCase()}`,
        52,
        30,
        { width: 400, characterSpacing: 0.9, lineBreak: false },
      );
      doc.strokeColor(COLORS.line).moveTo(52, 44).lineTo(560, 44).stroke();
    }
    doc.strokeColor(COLORS.line).moveTo(52, 762).lineTo(560, 762).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(
      `Run ${runId}`,
      52,
      770,
      { width: 400, lineBreak: false },
    );
    doc.text(`Page ${index + 1} of ${range.count}`, 460, 770, {
      width: 100,
      align: 'right',
      lineBreak: false,
    });
  }

  doc.end();
  return completed;
}
