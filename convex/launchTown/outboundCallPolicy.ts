export const OUTBOUND_CALL_COOLDOWN_MS = 10 * 60 * 1_000;
export const OUTBOUND_CALL_WINDOW_MS = 24 * 60 * 60 * 1_000;
export const OUTBOUND_CALL_MAX_PER_WINDOW = 6;
export const OUTBOUND_CALL_ACTIVE_LEASE_MS = 20 * 60 * 1_000;
export const OUTBOUND_CALL_POLL_INTERVAL_MS = 5_000;

export type OutboundCallStatus = 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed';

export type BolnaExecutionStatus =
  | 'scheduled'
  | 'queued'
  | 'rescheduled'
  | 'initiated'
  | 'ringing'
  | 'in-progress'
  | 'call-disconnected'
  | 'completed'
  | 'balance-low'
  | 'busy'
  | 'no-answer'
  | 'canceled'
  | 'failed'
  | 'stopped'
  | 'error';

export type OutboundFailureCode =
  | 'provider_rejected'
  | 'provider_unavailable'
  | 'poll_timeout'
  | 'balance_low'
  | 'busy'
  | 'no_answer'
  | 'canceled'
  | 'failed';

export interface SafeCallFinding {
  label: string;
  summary: string;
  confidence?: number;
}

export interface CallGateInput {
  now: number;
  activeRequestedAt?: number;
  recentRequestedAts: number[];
}

export type CallGateDecision =
  | { ok: true }
  | {
      ok: false;
      code: 'CALL_ACTIVE' | 'CALL_COOLDOWN' | 'DAILY_LIMIT';
      retryAfterMs: number;
    };

export type OutboundCallRequestParseResult =
  | { ok: true; residentKey: string; productId?: string }
  | { ok: false; code: 'INVALID_REQUEST' | 'CONSENT_REQUIRED' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const E164 = /^\+[1-9]\d{7,14}$/;
const EXECUTION_STATUSES = new Set<BolnaExecutionStatus>([
  'scheduled',
  'queued',
  'rescheduled',
  'initiated',
  'ringing',
  'in-progress',
  'call-disconnected',
  'completed',
  'balance-low',
  'busy',
  'no-answer',
  'canceled',
  'failed',
  'stopped',
  'error',
]);

export function isValidE164(value: unknown): value is string {
  return typeof value === 'string' && E164.test(value);
}

export function maskE164(value: string): string {
  if (!isValidE164(value)) throw new Error('Outbound recipient must be E.164.');
  return `+•• •••••• ${value.slice(-4)}`;
}

export function isAllowedVoiceOrigin(origin: string | null, configured: string): boolean {
  if (!origin) return false;
  return configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .some((value) => {
      try {
        const parsed = new URL(value);
        const normalized = value.replace(/\/$/, '');
        return parsed.origin === normalized && parsed.origin === origin;
      } catch {
        return false;
      }
    });
}

/** Accepts only the consented, server-destination outbound request shape. */
export function parseOutboundCallRequest(value: unknown): OutboundCallRequestParseResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, code: 'INVALID_REQUEST' };
  }
  const body = value as Record<string, unknown>;
  const allowedKeys = new Set(['residentKey', 'productId', 'consent']);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    return { ok: false, code: 'INVALID_REQUEST' };
  }
  if (body.consent !== true) return { ok: false, code: 'CONSENT_REQUIRED' };
  if (typeof body.residentKey !== 'string' || !/^[a-z]{2,24}$/.test(body.residentKey)) {
    return { ok: false, code: 'INVALID_REQUEST' };
  }
  if (body.productId !== undefined && typeof body.productId !== 'string') {
    return { ok: false, code: 'INVALID_REQUEST' };
  }
  return {
    ok: true,
    residentKey: body.residentKey,
    ...(body.productId === undefined ? {} : { productId: body.productId }),
  };
}

export function evaluateCallGate(input: CallGateInput): CallGateDecision {
  const { now, activeRequestedAt, recentRequestedAts } = input;
  if (activeRequestedAt !== undefined && now - activeRequestedAt < OUTBOUND_CALL_ACTIVE_LEASE_MS) {
    return {
      ok: false,
      code: 'CALL_ACTIVE',
      retryAfterMs: OUTBOUND_CALL_ACTIVE_LEASE_MS - (now - activeRequestedAt),
    };
  }

  const withinWindow = recentRequestedAts
    .filter((requestedAt) => now - requestedAt < OUTBOUND_CALL_WINDOW_MS)
    .sort((a, b) => b - a);
  const latest = withinWindow[0];
  if (latest !== undefined && now - latest < OUTBOUND_CALL_COOLDOWN_MS) {
    return {
      ok: false,
      code: 'CALL_COOLDOWN',
      retryAfterMs: OUTBOUND_CALL_COOLDOWN_MS - (now - latest),
    };
  }
  if (withinWindow.length >= OUTBOUND_CALL_MAX_PER_WINDOW) {
    const oldest = withinWindow[withinWindow.length - 1];
    return {
      ok: false,
      code: 'DAILY_LIMIT',
      retryAfterMs: Math.max(1, OUTBOUND_CALL_WINDOW_MS - (now - oldest)),
    };
  }
  return { ok: true };
}

export function parseExecutionId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const executionId = (value as { execution_id?: unknown }).execution_id;
  return typeof executionId === 'string' && UUID.test(executionId) ? executionId : null;
}

export function parseExecutionStatus(value: unknown): BolnaExecutionStatus | null {
  return typeof value === 'string' && EXECUTION_STATUSES.has(value as BolnaExecutionStatus)
    ? (value as BolnaExecutionStatus)
    : null;
}

export function mapExecutionStatus(status: BolnaExecutionStatus): OutboundCallStatus {
  if (status === 'completed') return 'completed';
  if (status === 'ringing') return 'ringing';
  if (status === 'in-progress' || status === 'call-disconnected') return 'in-progress';
  if (
    status === 'balance-low' ||
    status === 'busy' ||
    status === 'no-answer' ||
    status === 'canceled' ||
    status === 'failed' ||
    status === 'stopped' ||
    status === 'error'
  ) {
    return 'failed';
  }
  return 'initiated';
}

export function failureCodeForStatus(
  status: BolnaExecutionStatus,
): OutboundFailureCode | undefined {
  if (status === 'balance-low') return 'balance_low';
  if (status === 'busy') return 'busy';
  if (status === 'no-answer') return 'no_answer';
  if (status === 'canceled') return 'canceled';
  if (status === 'failed' || status === 'stopped' || status === 'error') return 'failed';
  return undefined;
}

export function isTerminalCallStatus(status: OutboundCallStatus): boolean {
  return status === 'completed' || status === 'failed';
}

function cleanText(value: string, maxLength: number): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted email]')
    .replace(/https?:\/\/\S+/gi, '[redacted link]')
    .replace(/\+[1-9]\d{7,14}/g, '[redacted phone]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

const PRIVATE_FIELD = /phone|number|email|address|recording|transcript|url|provider.call.id/i;
const LOW_VALUE_FIELD = /reasoning|validation|confidence.label/i;

/** Flattens provider extraction output into a small, privacy-scrubbed findings list. */
export function sanitizeExtractedFindings(value: unknown): SafeCallFinding[] {
  const findings: SafeCallFinding[] = [];
  const seen = new Set<string>();

  const add = (path: string[], raw: unknown, confidence?: unknown) => {
    if (findings.length >= 6 || path.some((part) => PRIVATE_FIELD.test(part))) return;
    if (path.some((part) => LOW_VALUE_FIELD.test(part))) return;
    if (!['string', 'number', 'boolean'].includes(typeof raw)) return;
    const label = cleanText(path.join(' · '), 80);
    const summary = cleanText(String(raw), 240);
    if (!label || !summary || seen.has(`${label}\0${summary}`)) return;
    seen.add(`${label}\0${summary}`);
    const numericConfidence =
      typeof confidence === 'number' && Number.isFinite(confidence)
        ? Math.min(1, Math.max(0, confidence))
        : undefined;
    findings.push({
      label,
      summary,
      ...(numericConfidence === undefined ? {} : { confidence: numericConfidence }),
    });
  };

  const visit = (node: unknown, path: string[], depth: number) => {
    if (findings.length >= 6 || depth > 5 || node === null || node === undefined) return;
    if (Array.isArray(node)) {
      node
        .slice(0, 6)
        .forEach((item, index) => visit(item, [...path, String(index + 1)], depth + 1));
      return;
    }
    if (typeof node !== 'object') {
      add(path, node);
      return;
    }
    const record = node as Record<string, unknown>;
    const preferred = record.objective ?? record.subjective;
    if (preferred !== undefined) {
      add(path, preferred, record.confidence);
      return;
    }
    Object.entries(record).forEach(([key, nested]) => visit(nested, [...path, key], depth + 1));
  };

  visit(value, [], 0);
  return findings;
}

export function safeDurationSeconds(value: unknown): number | undefined {
  const numeric =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(numeric) && numeric >= 0 ? Math.min(60 * 60, numeric) : undefined;
}

export interface SafeExecutionSnapshot {
  status: OutboundCallStatus;
  providerStatus: BolnaExecutionStatus;
  provider: 'vobiz' | 'unknown';
  durationSeconds?: number;
  findings: SafeCallFinding[];
  failureCode?: OutboundFailureCode;
}

/** Selects only lifecycle data that is safe to persist from the provider response. */
export function parseBolnaExecutionSnapshot(value: unknown): SafeExecutionSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const execution = value as Record<string, unknown>;
  const providerStatus = parseExecutionStatus(execution.status);
  if (!providerStatus) return null;
  const telephony =
    execution.telephony_data && typeof execution.telephony_data === 'object'
      ? (execution.telephony_data as Record<string, unknown>)
      : {};
  const providerValue = telephony.provider ?? execution.provider;
  const durationSeconds = safeDurationSeconds(
    execution.conversation_duration ?? telephony.duration,
  );
  const failureCode = failureCodeForStatus(providerStatus);
  return {
    status: mapExecutionStatus(providerStatus),
    providerStatus,
    provider: providerValue === 'vobiz' ? 'vobiz' : 'unknown',
    ...(durationSeconds === undefined ? {} : { durationSeconds }),
    findings: sanitizeExtractedFindings(execution.extracted_data),
    ...(failureCode === undefined ? {} : { failureCode }),
  };
}
