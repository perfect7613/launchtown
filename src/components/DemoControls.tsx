import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import LaunchReportPanel from './LaunchReportPanel';

const speeds = [1, 4, 16] as const;

export default function DemoControls() {
  const scenario = useQuery(api.launchTown.scenario.getLedgerly);
  const seedLedgerly = useMutation(api.launchTown.scenario.seedLedgerly);
  const startSimulation = useMutation(api.launchTown.scenario.startSimulation);
  const setSimulationSpeed = useMutation(api.launchTown.scenario.setSimulationSpeed);
  const advanceClock = useMutation(api.launchTown.scenario.advanceScenarioClock);
  const [starting, setStarting] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (
      !scenario?.phase ||
      scenario.phase.phase === 'seeded' ||
      scenario.phase.phase === 'complete'
    ) {
      return;
    }
    const timer = window.setInterval(() => void advanceClock(), 1_000);
    return () => window.clearInterval(timer);
  }, [advanceClock, scenario?.phase]);

  const start = async () => {
    setStarting(true);
    try {
      if (!scenario) await seedLedgerly();
      await startSimulation();
    } finally {
      setStarting(false);
    }
  };

  return (
    <section className="mx-auto mb-3 flex w-full max-w-[1400px] items-center justify-between gap-4 rounded border-4 border-brown-900 bg-brown-800 px-4 py-3 text-white shadow-solid">
      <div>
        <div className="text-xl font-bold">Ledgerly causal cascade</div>
        <div className="text-sm text-white/75">
          Phase: {scenario?.phase?.phase ?? 'not seeded'} · Day{' '}
          {scenario?.phase?.simulationDay ?? 1}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm">Speed</span>
        {speeds.map((speed) => (
          <button
            key={speed}
            type="button"
            className={`pointer-events-auto rounded px-3 py-2 text-sm ${
              scenario?.phase?.speed === speed ? 'bg-amber-400 text-brown-900' : 'bg-brown-900'
            }`}
            onClick={() => void setSimulationSpeed({ speed })}
            disabled={!scenario}
          >
            {speed}×
          </button>
        ))}
        <button
          type="button"
          className="pointer-events-auto rounded bg-emerald-500 px-4 py-2 font-bold text-brown-900 disabled:opacity-60"
          onClick={() => void start()}
          disabled={starting}
        >
          {starting ? 'Starting…' : 'Start Simulation'}
        </button>
        <button
          type="button"
          className="pointer-events-auto rounded bg-fuchsia-300 px-4 py-2 font-bold text-brown-900 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => setShowReport(true)}
          disabled={!scenario || scenario.phase?.phase !== 'complete'}
          title={
            scenario?.phase?.phase === 'complete' ? undefined : 'Complete the simulation first'
          }
        >
          Generate Launch Report
        </button>
      </div>
      {showReport && scenario?.product?._id && (
        <LaunchReportPanel productId={scenario.product._id} onClose={() => setShowReport(false)} />
      )}
    </section>
  );
}
