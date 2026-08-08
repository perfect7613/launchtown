import { useLaunchTown, SimSpeed } from '../launchtown/useLaunchTown';
import { STAGE_META, STAGE_ORDER } from '../launchtown/types';

const STAGE_DOTS: Record<string, string> = {
  unaware: '⚪',
  aware: '🔵',
  considering: '🟡',
  converted: '🟢',
  rejected: '🔴',
};

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <span className="text-xs uppercase tracking-wider text-clay-100/70">{label}</span>
      <div className="flex-grow h-2 rounded bg-clay-900/80 overflow-hidden min-w-[48px]">
        <div
          className="h-full rounded bg-yellow-400 transition-all duration-500"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="text-xs text-white tabular-nums w-8 text-right">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export default function MetricsBar({
  playerNames,
  followedName,
  onFollowCascade,
}: {
  playerNames: string[];
  followedName?: string;
  onFollowCascade: () => void;
}) {
  const lt = useLaunchTown();
  const m = lt.metrics(playerNames);

  return (
    <div className="lt-panel mx-auto w-full max-w-[1400px] mb-2 px-3 py-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-white">
      {/* Product */}
      <div className="flex items-center gap-2 max-w-[260px]">
        <span className="text-xs uppercase tracking-wider text-clay-100/70">Rehearsing</span>
        <span className="truncate text-sm text-yellow-300 font-body" title={lt.product?.url}>
          {lt.product ? new URL(lt.product.url).hostname : '—'}
        </span>
        {lt.productAnalysisStatus === 'pending' && (
          <span className="whitespace-nowrap text-xs text-blue-300">Claude analyzing…</span>
        )}
        {lt.productAnalysisStatus === 'complete' && lt.productCategory && (
          <span className="max-w-[180px] truncate text-xs text-green-300" title={lt.productCategory}>
            ✓ {lt.productCategory}
          </span>
        )}
        <button
          className="text-xs text-clay-100/50 hover:text-white underline"
          onClick={lt.resetProduct}
          title="Change website"
        >
          change
        </button>
      </div>

      {/* Funnel counts */}
      <div className="flex items-center gap-3">
        {STAGE_ORDER.map((s) => (
          <span key={s} className="flex items-center gap-1 text-sm" title={STAGE_META[s].label}>
            <span className="text-xs">{STAGE_DOTS[s]}</span>
            <span className="tabular-nums">{m.stageCounts[s]}</span>
          </span>
        ))}
      </div>

      {/* Averages */}
      <div className="hidden md:flex items-center gap-4 flex-grow">
        <Meter label="Aware" value={m.avg.awareness} />
        <Meter label="Trust" value={m.avg.trust} />
        <Meter label="Intent" value={m.avg.intent} />
      </div>

      {/* Sim controls */}
      <div className="flex items-center gap-2 ml-auto">
        {!lt.simRunning ? (
          <button
            onClick={lt.startSimulation}
            className="rounded bg-green-500 hover:bg-green-400 text-black font-display tracking-wider px-4 py-1.5 text-lg shadow-[0_3px_0_#14532d]"
          >
            ▶ Start simulation
          </button>
        ) : (
          <>
            <span className="text-xs uppercase tracking-wider text-clay-100/70">
              Day 1 · {Math.floor(lt.simSeconds)}s
            </span>
            {[1, 4, 16].map((s) => (
              <button
                key={s}
                onClick={() => lt.setSpeed(s as SimSpeed)}
                className={
                  'rounded px-2 py-1 text-sm font-body border ' +
                  (lt.speed === s
                    ? 'bg-yellow-400 text-black border-yellow-400'
                    : 'text-clay-100/80 border-clay-500 hover:border-yellow-400')
                }
              >
                {s}×
              </button>
            ))}
            <button
              onClick={lt.resetSimulation}
              className="text-xs text-clay-100/50 hover:text-white underline"
            >
              reset
            </button>
          </>
        )}
        <button
          onClick={onFollowCascade}
          className={
            'rounded px-3 py-1.5 text-sm font-body border ' +
            (followedName
              ? 'bg-blue-500 text-white border-blue-400'
              : 'text-blue-300 border-blue-500 hover:bg-blue-500 hover:text-white')
          }
          title="Viewport tracks the resident at the center of the causal cascade"
        >
          {followedName ? `◉ Following ${followedName}` : '◎ Follow cascade'}
        </button>
      </div>
    </div>
  );
}
