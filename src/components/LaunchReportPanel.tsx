import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { readReportApiResponse } from '../launchReport/apiResponse';
import type { ReportArtifact } from '../launchReport/report';

interface LaunchReportPanelProps {
  productId: string;
  onClose: () => void;
}

function severityClass(severity: 'high' | 'medium' | 'low'): string {
  if (severity === 'high') return 'bg-red-400/20 text-red-200';
  if (severity === 'medium') return 'bg-amber-400/20 text-amber-100';
  return 'bg-sky-400/20 text-sky-100';
}

export default function LaunchReportPanel({ productId, onClose }: LaunchReportPanelProps) {
  const [report, setReport] = useState<ReportArtifact>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => trigger?.focus();
  }, []);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ) ?? []),
    ];
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const generate = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch('/api/launch-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const body = await readReportApiResponse(response);
      if (!response.ok || !('markdown' in body)) {
        throw new Error(typeof body.error === 'string' ? body.error : 'Unable to generate report');
      }
      setReport(body as unknown as ReportArtifact);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to generate report');
    } finally {
      setLoading(false);
    }
  };

  const copyMarkdown = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.markdown);
      setCopied(true);
      setError(undefined);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to copy the report');
    }
  };

  const downloadMarkdown = () => {
    if (!report) return;
    const blobUrl = URL.createObjectURL(new Blob([report.markdown], { type: 'text/markdown' }));
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = `${report.productName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-launch-report.md`;
    anchor.click();
    URL.revokeObjectURL(blobUrl);
  };

  const downloadPdf = async () => {
    if (!report) return;
    setDownloadingPdf(true);
    setError(undefined);
    try {
      const response = await fetch('/api/launch-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, format: 'pdf' }),
      });
      if (!response.ok) {
        const body = await readReportApiResponse(response);
        throw new Error(typeof body.error === 'string' ? body.error : 'Unable to download PDF');
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = `${report.productName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-launch-report.pdf`;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="launch-report-title"
      tabIndex={-1}
      onKeyDown={handleDialogKeyDown}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/95 px-4 py-6 text-slate-100 sm:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-700 pb-5">
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.3em] text-amber-300">
              Claude agent artifact
            </div>
            <h2
              id="launch-report-title"
              className="font-display text-4xl tracking-wide sm:text-5xl"
            >
              Launch Report
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              An evidence-grounded readout of resident journeys, social belief spread, and the
              highest-leverage site fixes.
            </p>
          </div>
          <div className="flex gap-2">
            {report && (
              <>
                <button
                  type="button"
                  className="rounded bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
                  onClick={() => void downloadPdf()}
                  disabled={downloadingPdf}
                >
                  {downloadingPdf ? 'Preparing PDF…' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"
                  onClick={() => void copyMarkdown()}
                >
                  {copied ? 'Copied' : 'Copy markdown'}
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"
                  onClick={downloadMarkdown}
                >
                  Download .md
                </button>
              </>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              className="rounded bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
              onClick={onClose}
            >
              Back to town
            </button>
          </div>
        </header>

        {error && <p className="mb-5 rounded bg-red-950/70 p-3 text-sm text-red-200">{error}</p>}

        {!report && (
          <section className="lt-panel mx-auto mt-16 max-w-2xl p-8 text-center">
            <div className="text-5xl">↗</div>
            <h3 className="mt-4 text-2xl font-bold">Turn the simulation into decisions</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Claude will start a scoped session, inspect all four read-only evidence tools, and
              assemble a report. It cannot modify resident or simulation state.
            </p>
            <button
              type="button"
              className="mt-7 rounded bg-amber-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-60"
              onClick={() => void generate()}
              disabled={loading}
            >
              {loading ? 'Agent is investigating…' : 'Generate Launch Report'}
            </button>
            {loading && (
              <div className="mx-auto mt-5 h-1 max-w-md overflow-hidden rounded bg-slate-800">
                <div className="h-full w-1/2 animate-pulse rounded bg-amber-400" />
              </div>
            )}
          </section>
        )}

        {report && (
          <div className="space-y-8 pb-16">
            <section className="lt-panel p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-3xl font-bold">{report.productName}</h3>
                  <a
                    className="text-sm text-sky-300 hover:underline"
                    href={report.productUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {report.productUrl}
                  </a>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <div>Session {report.sessionId.slice(0, 8)}</div>
                  <div>{new Date(report.generatedAt).toLocaleString()}</div>
                </div>
              </div>
              <p className="mt-6 text-lg leading-8 text-slate-200">{report.executiveSummary}</p>
            </section>

            <section>
              <h3 className="mb-4 text-2xl font-bold text-amber-300">Top frictions discovered</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {report.topFrictions.map((friction) => (
                  <article key={friction.title} className="lt-panel p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-lg font-bold">{friction.title}</h4>
                      <span
                        className={`rounded px-2 py-1 text-[10px] uppercase ${severityClass(
                          friction.severity,
                        )}`}
                      >
                        {friction.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Hit by {friction.residents.join(', ')}
                    </p>
                    <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
                      {friction.evidence.map((evidence) => (
                        <li key={evidence}>“{evidence}”</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-2xl font-bold text-sky-300">How beliefs spread</h3>
              <div className="space-y-4">
                {report.beliefSpread.map((spread) => (
                  <article key={`${spread.belief}-${spread.source}`} className="lt-panel p-5">
                    <p className="font-bold">“{spread.belief}”</p>
                    <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">
                      Source · {spread.source}
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {spread.listeners.map((listener) => (
                        <div key={listener.resident} className="rounded bg-slate-900/70 p-4">
                          <div className="font-bold text-sky-200">→ {listener.resident}</div>
                          <p className="mt-2 text-sm text-slate-300">{listener.evidence}</p>
                          <p className="mt-2 text-sm text-emerald-300">
                            Behavior: {listener.behaviorChange}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-2xl font-bold text-emerald-300">
                Funnel outcomes by resident
              </h3>
              <div className="overflow-x-auto rounded-lg border border-slate-700">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-900 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="p-3">Resident</th>
                      <th className="p-3">Stage</th>
                      <th className="p-3">Outcome</th>
                      <th className="p-3">Journey</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.funnelOutcomes.map((resident) => (
                      <tr key={resident.resident} className="border-t border-slate-800">
                        <td className="p-3 font-bold">{resident.resident}</td>
                        <td className="p-3 text-amber-200">{resident.stage}</td>
                        <td className="p-3">{resident.outcome}</td>
                        <td className="p-3 text-slate-400">
                          {resident.pagesVisited.join(' → ') || 'No browser journey'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-2xl font-bold text-fuchsia-300">
                Three recommended site fixes
              </h3>
              <div className="grid gap-4 lg:grid-cols-3">
                {report.recommendations.map((recommendation, index) => (
                  <article key={recommendation.title} className="lt-panel p-5">
                    <div className="text-xs font-bold text-fuchsia-300">
                      {String(index + 1).padStart(2, '0')} · {recommendation.priority}
                    </div>
                    <h4 className="mt-2 text-lg font-bold">{recommendation.title}</h4>
                    <p className="mt-3 text-sm leading-6 text-slate-200">{recommendation.fix}</p>
                    <p className="mt-3 text-xs leading-5 text-slate-400">
                      {recommendation.rationale}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
