const FALLBACK_ERROR = 'Unable to generate report';

export async function readReportApiResponse(
  response: Pick<Response, 'ok' | 'text'>,
): Promise<Record<string, unknown>> {
  const raw = await response.text();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Vercel may return a plain-text platform error before the handler runs.
  }

  const firstLine = raw.trim().split(/\r?\n/, 1)[0]?.trim();
  const safePlatformMessage =
    !response.ok && firstLine && !firstLine.startsWith('<')
      ? firstLine.slice(0, 200)
      : FALLBACK_ERROR;
  return { error: safePlatformMessage };
}
