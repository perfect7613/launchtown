import { useEffect, useState } from 'react';
import clsx from 'clsx';
import type { Id } from '../../convex/_generated/dataModel';
import { useBolnaCall } from '../hooks/useBolnaCall';
import { useOutboundInterview } from '../hooks/useOutboundInterview';
import { useLaunchTown } from '../launchtown/useLaunchTown';
import { outboundCallPresentation } from '../launchtown/outboundCallUi';

const TONE_CLASSES = {
  amber: 'border-amber-400/50 bg-amber-400/10 text-amber-100',
  blue: 'border-blue-400/50 bg-blue-400/10 text-blue-100',
  green: 'border-green-400/50 bg-green-400/10 text-green-100',
  red: 'border-red-400/50 bg-red-400/10 text-red-100',
};

function outboundErrorMessage(code: string, retryAfterSeconds?: number): string {
  if (code === 'CALL_ACTIVE') return 'Another phone interview is already active.';
  if (code === 'CALL_COOLDOWN') {
    const minutes = Math.max(1, Math.ceil((retryAfterSeconds ?? 60) / 60));
    return `Phone interviews are cooling down. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  }
  if (code === 'DAILY_LIMIT') return 'Today’s phone interview allowance has been used.';
  if (code === 'CONSENT_REQUIRED') return 'Confirm consent before requesting the call.';
  if (code === 'CONTEXT_NOT_FOUND') return 'This resident’s live context is not ready yet.';
  if (code === 'OUTBOUND_NOT_CONFIGURED') return 'Phone interviews are not configured.';
  if (code === 'provider_rejected') return 'Bolna could not accept this call request.';
  if (code === 'NETWORK_ERROR') return 'The call request could not reach LaunchTown.';
  return 'The outbound line is temporarily unavailable.';
}

export function ResidentVoiceCall({ resident }: { resident: string }) {
  const residentKey = resident.trim().toLowerCase();
  const { product } = useLaunchTown();
  const productId = product?.convexId as Id<'products'> | undefined;
  const browserCall = useBolnaCall(residentKey, productId);
  const outbound = useOutboundInterview(residentKey, productId);
  const [consented, setConsented] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const lifecycle = outbound.latest
    ? outboundCallPresentation(outbound.latest.status, outbound.latest.failureCode)
    : undefined;
  const cooldownActive = !!outbound.latest && now < outbound.latest.nextAllowedAt;
  const cooldownMinutes = outbound.latest
    ? Math.max(1, Math.ceil((outbound.latest.nextAllowedAt - now) / 60_000))
    : 0;
  const outboundDisabled =
    !outbound.configuration.available ||
    !consented ||
    outbound.starting ||
    lifecycle?.active ||
    cooldownActive ||
    browserCall.state !== 'idle';
  const browserActive = browserCall.state === 'active';

  const requestPhoneCall = async () => {
    await outbound.start();
    setConsented(false);
  };

  return (
    <section className="mt-5 overflow-hidden rounded border border-clay-500/80 bg-clay-900/55">
      <div className="border-b border-clay-500/50 bg-clay-900/70 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-base tracking-wider text-white">
              Interview {resident}
            </div>
            <div className="mt-0.5 text-[11px] leading-snug text-clay-100/55">
              Voice uses Bolna&apos;s stack. Simulation cognition is Claude.
            </div>
          </div>
          <span className="rounded-full border border-green-400/40 bg-green-400/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-green-200">
            live context
          </span>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs uppercase tracking-wider text-clay-100/65">
            <span>Phone interview</span>
            {outbound.configuration.destinationMask && (
              <span className="font-body normal-case tracking-normal text-white/80">
                {outbound.configuration.destinationMask}
              </span>
            )}
          </div>

          {outbound.configuration.loading ? (
            <div className="rounded border border-clay-500/50 px-3 py-2 text-xs text-clay-100/60">
              Checking the outbound line…
            </div>
          ) : outbound.configuration.available ? (
            <>
              {!lifecycle?.active && (
                <label className="mb-2 flex cursor-pointer items-start gap-2 rounded border border-clay-500/50 bg-black/15 p-2 text-xs leading-snug text-clay-100/75">
                  <input
                    type="checkbox"
                    checked={consented}
                    onChange={(event) => setConsented(event.target.checked)}
                    disabled={outbound.starting || cooldownActive || browserCall.state !== 'idle'}
                    className="mt-0.5 rounded border-clay-400 bg-clay-900 text-yellow-400 focus:ring-yellow-400"
                  />
                  <span>
                    I consent to receive one AI voice call at{' '}
                    <strong className="text-white">{outbound.configuration.destinationMask}</strong>
                    . No phone number, recording, or transcript is stored by LaunchTown.
                  </span>
                </label>
              )}
              <button
                type="button"
                onClick={() => void requestPhoneCall()}
                disabled={outboundDisabled}
                className={clsx(
                  'w-full rounded border px-3 py-2.5 font-body text-sm transition-colors',
                  outboundDisabled
                    ? 'cursor-not-allowed border-clay-500/50 bg-clay-700/30 text-clay-100/40'
                    : 'border-yellow-300 bg-yellow-400 text-black shadow-[0_3px_0_#a16207] hover:-translate-y-px hover:bg-yellow-300',
                )}
              >
                {outbound.starting
                  ? 'Requesting call…'
                  : lifecycle?.active
                    ? lifecycle.label
                    : cooldownActive
                      ? `Available in ~${cooldownMinutes}m`
                      : '☎ Call my phone'}
              </button>
            </>
          ) : (
            <div className="rounded border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
              The phone line is unavailable. Use browser audio below.
            </div>
          )}

          {lifecycle && (
            <div
              aria-live="polite"
              className={clsx(
                'mt-2 rounded border px-2.5 py-2 text-xs',
                TONE_CLASSES[lifecycle.tone],
              )}
            >
              <div className="font-bold">{lifecycle.label}</div>
              <div className="mt-0.5 opacity-75">{lifecycle.detail}</div>
              {outbound.latest?.durationSeconds !== undefined && (
                <div className="mt-1 tabular-nums opacity-75">
                  Duration: {Math.round(outbound.latest.durationSeconds)}s · provider{' '}
                  {outbound.latest.provider}
                </div>
              )}
            </div>
          )}

          {outbound.error && (
            <div role="alert" className="mt-2 text-xs leading-snug text-red-300">
              {outboundErrorMessage(outbound.error.code, outbound.error.retryAfterSeconds)}
            </div>
          )}

          {!!outbound.latest?.findings.length && (
            <div className="mt-2 rounded border border-green-400/30 bg-green-400/5 p-2">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-green-200/75">
                Saved findings
              </div>
              <ul className="space-y-1.5">
                {outbound.latest.findings.map((finding, index) => (
                  <li
                    key={`${finding.label}-${index}`}
                    className="text-xs leading-snug text-white/85"
                  >
                    <span className="text-green-200">{finding.label}:</span> {finding.summary}
                    {finding.confidence !== undefined && (
                      <span className="ml-1 text-clay-100/45">
                        ({Math.round(finding.confidence * 100)}%)
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-clay-100/35">
          <span className="h-px flex-1 bg-clay-500/40" />
          browser fallback
          <span className="h-px flex-1 bg-clay-500/40" />
        </div>

        <button
          type="button"
          onClick={browserActive ? () => void browserCall.stop() : () => void browserCall.start()}
          disabled={browserCall.state === 'connecting' || lifecycle?.active}
          className={clsx(
            'relative w-full overflow-hidden rounded border px-3 py-2 font-body text-xs transition-colors',
            browserActive
              ? 'border-red-400 bg-red-500/20 text-red-100 hover:bg-red-500/30'
              : browserCall.state === 'connecting' || lifecycle?.active
                ? 'cursor-wait border-clay-500/50 bg-clay-700/20 text-clay-100/40'
                : 'border-blue-400/60 bg-blue-400/10 text-blue-100 hover:bg-blue-400/20',
          )}
        >
          {browserActive && (
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-red-400/20 transition-[width] duration-100"
              style={{ width: `${Math.max(8, Math.round(browserCall.volume * 100))}%` }}
            />
          )}
          <span className="relative">
            {browserCall.state === 'connecting'
              ? 'Opening browser audio…'
              : browserActive
                ? `● Live with ${resident} — hang up`
                : '🎙 Use browser microphone instead'}
          </span>
        </button>

        {browserCall.error && (
          <div role="alert" className="text-xs leading-snug text-red-300">
            {browserCall.error.code === 'microphone_denied'
              ? 'Microphone access was blocked. Allow microphone access and try again.'
              : browserCall.error.code === 'at_capacity'
                ? 'The browser interview line is busy. Try again in a moment.'
                : browserCall.error.message}
          </div>
        )}
      </div>
    </section>
  );
}
