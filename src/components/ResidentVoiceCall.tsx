import clsx from 'clsx';
import { useBolnaCall } from '../hooks/useBolnaCall';

export function ResidentVoiceCall({ resident }: { resident: string }) {
  const residentKey = resident.trim().toLowerCase();
  const { state, error, volume, start, stop } = useBolnaCall(residentKey);
  const active = state === 'active';

  return (
    <section className="mt-5 rounded border border-clay-500/80 bg-clay-900/50 p-3">
      <button
        type="button"
        onClick={active ? () => void stop() : () => void start()}
        disabled={state === 'connecting'}
        className={clsx(
          'relative w-full overflow-hidden rounded border px-3 py-2.5 font-body text-sm transition-colors',
          active
            ? 'border-red-400 bg-red-500/20 text-red-100 hover:bg-red-500/30'
            : state === 'connecting'
              ? 'cursor-wait border-yellow-400/60 bg-yellow-400/10 text-yellow-100'
              : 'border-yellow-400 bg-yellow-400 text-black hover:bg-yellow-300',
        )}
      >
        {active && (
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 bg-red-400/20 transition-[width] duration-100"
            style={{ width: `${Math.max(8, Math.round(volume * 100))}%` }}
          />
        )}
        <span className="relative">
          {state === 'connecting'
            ? `◌ Calling ${resident}…`
            : active
              ? `● Live with ${resident} — hang up`
              : `📞 Interview ${resident}`}
        </span>
      </button>

      {error && (
        <div role="alert" className="mt-2 text-xs leading-snug text-red-300">
          {error.code === 'microphone_denied'
            ? 'Microphone access was blocked. Allow microphone access and try again.'
            : error.code === 'at_capacity'
              ? 'The interview line is busy. Try again in a moment.'
              : error.message}
        </div>
      )}
      <div className="mt-2 text-[11px] leading-snug text-clay-100/55">
        Voice conversation uses Bolna&apos;s stack. Simulation cognition is Claude.
      </div>
    </section>
  );
}
