import { useQuery } from 'convex/react';
import clsx from 'clsx';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import closeImg from '../../assets/close.svg';
import { SelectElement } from './Player';
import { Messages } from './Messages';
import { GameId } from '../../convex/aiTown/ids';
import { ServerGame } from '../hooks/serverGame';
import { useLaunchTown } from '../launchtown/useLaunchTown';
import {
  Belief,
  InspectorTab,
  ResidentSnapshot,
  STAGE_META,
  StateBars,
} from '../launchtown/types';

const BAR_COLORS: Record<keyof StateBars, string> = {
  awareness: '#60a5fa',
  curiosity: '#facc15',
  trust: '#4ade80',
  intent: '#c084fc',
};

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-sm text-clay-100/90">
        <span className="uppercase tracking-wider">{label}</span>
        <span className="tabular-nums text-white">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-3 rounded bg-clay-900 overflow-hidden">
        <div
          className="h-full rounded transition-all duration-500"
          style={{ width: `${Math.round(value * 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function BeliefRow({ belief }: { belief: Belief }) {
  const hearsay = belief.source.kind === 'hearsay';
  return (
    <li className="mb-2 rounded bg-clay-900/60 p-2">
      <div className="text-sm text-white leading-snug">“{belief.claim}”</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <span
          className={clsx(
            'rounded px-1.5 py-0.5 font-body',
            hearsay ? 'bg-purple-500/30 text-purple-200' : 'bg-teal-500/30 text-teal-200',
          )}
        >
          {hearsay
            ? `heard from ${(belief.source as { from: string }).from}`
            : 'observed personally'}
        </span>
        <span className="text-clay-100/60 tabular-nums">
          {Math.round(belief.confidence * 100)}% confidence
        </span>
      </div>
    </li>
  );
}

function MindTab({ snapshot }: { snapshot: ResidentSnapshot }) {
  const stage = STAGE_META[snapshot.stage];
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs uppercase tracking-wider text-clay-100/70">Funnel stage</span>
        <span
          className="rounded-full px-3 py-0.5 text-sm font-bold text-black"
          style={{ backgroundColor: stage.css }}
        >
          {stage.label}
        </span>
      </div>
      <StatBar label="Awareness" value={snapshot.bars.awareness} color={BAR_COLORS.awareness} />
      <StatBar label="Curiosity" value={snapshot.bars.curiosity} color={BAR_COLORS.curiosity} />
      <StatBar label="Trust" value={snapshot.bars.trust} color={BAR_COLORS.trust} />
      <StatBar label="Purchase intent" value={snapshot.bars.intent} color={BAR_COLORS.intent} />

      <h3 className="mt-5 mb-2 text-sm uppercase tracking-wider text-clay-100/70">
        Beliefs about the product
      </h3>
      {snapshot.beliefs.length === 0 ? (
        <div className="text-sm text-clay-100/50 italic">
          No beliefs yet — hasn't heard about it.
        </div>
      ) : (
        <ul>
          {snapshot.beliefs.map((b, i) => (
            <BeliefRow key={i} belief={b} />
          ))}
        </ul>
      )}

      <button
        disabled
        title="Voice interviews (Bolna) land after the P0 cascade is green"
        className="mt-5 w-full rounded border-2 border-dashed border-clay-500 py-2 text-clay-100/50 cursor-not-allowed font-body"
      >
        📞 Call {snapshot.resident} — coming up
      </button>
    </div>
  );
}

function BrowserTab({ snapshot }: { snapshot: ResidentSnapshot }) {
  const { browser } = snapshot;
  // SECURITY: browser.liveViewUrl is a credential. It is only ever assigned
  // to the iframe src below — never logged, never rendered as text.
  const live = browser.status === 'running' && browser.liveViewUrl;
  return (
    <div className="flex flex-col h-full">
      {browser.objective && (
        <div className="mb-3 rounded bg-blue-500/15 border border-blue-400/40 p-2 text-sm text-blue-100">
          <span className="text-xs uppercase tracking-wider text-blue-300 block">
            Current objective
          </span>
          {browser.objective}
        </div>
      )}
      {live ? (
        <iframe
          src={browser.liveViewUrl}
          title={`${snapshot.resident}'s live browser`}
          className="w-full flex-grow min-h-[320px] rounded border-2 border-clay-500 bg-black"
          sandbox="allow-scripts allow-same-origin"
          allow="clipboard-read; clipboard-write"
        />
      ) : (
        <div className="rounded border-2 border-dashed border-clay-500 p-3">
          <div className="mb-2 text-sm text-amber-300">
            {browser.status === 'running'
              ? '⏳ Live browser starting…'
              : 'Live browser unavailable — showing last completed journey'}
          </div>
          {browser.lastJourney ? (
            <div>
              <div className="text-sm text-white mb-2">
                Outcome: <span className="text-yellow-300">{browser.lastJourney.outcome}</span>
              </div>
              <ol className="space-y-1.5">
                {browser.lastJourney.steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-clay-100/50 tabular-nums">{i + 1}.</span>
                    <span className="text-blue-300 font-body">{s.page}</span>
                    {s.note && <span className="text-clay-100/70">— {s.note}</span>}
                  </li>
                ))}
              </ol>
              {(browser.lastJourney.trustDelta !== undefined ||
                browser.lastJourney.intentDelta !== undefined) && (
                <div className="mt-3 flex gap-2 text-sm">
                  {browser.lastJourney.trustDelta !== undefined && (
                    <DeltaChip label="trust" delta={browser.lastJourney.trustDelta} />
                  )}
                  {browser.lastJourney.intentDelta !== undefined && (
                    <DeltaChip label="intent" delta={browser.lastJourney.intentDelta} />
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-clay-100/50 italic">
              {snapshot.resident} hasn't visited the website yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeltaChip({ label, delta }: { label: string; delta: number }) {
  const positive = delta >= 0;
  return (
    <span
      className={clsx(
        'rounded px-2 py-0.5 text-sm font-body tabular-nums',
        positive ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300',
      )}
    >
      {label} {positive ? '+' : '−'}
      {Math.round(Math.abs(delta) * 100)}%
    </span>
  );
}

function SocialTab({
  snapshot,
  worldId,
  game,
  playerId,
  scrollViewRef,
}: {
  snapshot: ResidentSnapshot;
  worldId: Id<'worlds'>;
  game: ServerGame;
  playerId: GameId<'players'>;
  scrollViewRef: React.RefObject<HTMLDivElement>;
}) {
  const player = game.world.players.get(playerId);
  const playerConversation = player && game.world.playerConversation(player);
  const inLiveConversation =
    playerConversation &&
    playerConversation.participants.get(playerId)?.status.kind === 'participating';
  const conv = snapshot.social.recentConversation;

  return (
    <div>
      <h3 className="mb-2 text-sm uppercase tracking-wider text-clay-100/70">Relationships</h3>
      <ul className="mb-4 space-y-1.5">
        {snapshot.social.relationships.map((r) => (
          <li key={r.name} className="flex items-center gap-2 text-sm">
            <span className="w-16 text-white">{r.name}</span>
            <div className="flex-grow h-2 rounded bg-clay-900 overflow-hidden">
              <div
                className="h-full rounded bg-pink-400"
                style={{ width: `${Math.round(r.strength * 100)}%` }}
              />
            </div>
            <span className="text-xs text-clay-100/60 tabular-nums w-8 text-right">
              {r.strength.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>

      <h3 className="mb-2 text-sm uppercase tracking-wider text-clay-100/70">
        Recent conversation
      </h3>
      {conv ? (
        <div className="rounded bg-clay-900/60 p-2 mb-3">
          <div className="text-xs text-clay-100/60 mb-2">with {conv.with}</div>
          {conv.lines.map((l, i) => (
            <div key={i} className="mb-2 text-sm leading-snug">
              <span className="text-yellow-300">{l.speaker}:</span>{' '}
              <span className="text-white">“{l.text}”</span>
            </div>
          ))}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {conv.deltas.map((d, i) => (
              <DeltaChip key={i} label={d.stat} delta={d.delta} />
            ))}
          </div>
          {conv.triggeredVisit && (
            <div className="mt-2 rounded bg-yellow-400/15 border border-yellow-400/40 px-2 py-1 text-sm text-yellow-200">
              ↳ {conv.triggeredVisit}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-clay-100/50 italic mb-3">
          No product conversations yet.
        </div>
      )}

      {/* Live AI Town conversation stream, when one is happening right now. */}
      {inLiveConversation && playerConversation && (
        <Messages
          worldId={worldId}
          conversation={{ kind: 'active', doc: playerConversation }}
          scrollViewRef={scrollViewRef}
        />
      )}
    </div>
  );
}

export default function ResidentInspector({
  worldId,
  game,
  playerId,
  setSelectedElement,
  scrollViewRef,
  activeTab,
  setActiveTab,
  followedPlayerId,
  setFollowedPlayerId,
}: {
  worldId: Id<'worlds'>;
  game: ServerGame;
  playerId?: GameId<'players'>;
  setSelectedElement: SelectElement;
  scrollViewRef: React.RefObject<HTMLDivElement>;
  activeTab: InspectorTab;
  setActiveTab: (t: InspectorTab) => void;
  followedPlayerId?: GameId<'players'>;
  setFollowedPlayerId: (id?: GameId<'players'>) => void;
}) {
  const lt = useLaunchTown();
  const allNames = [...game.playerDescriptions.values()].map((d) => d.name);

  if (!playerId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center gap-3 p-4 text-clay-100/70">
        <div className="text-5xl">🏘️</div>
        <div className="text-xl text-white">Click a resident to inspect their mind</div>
        <div className="text-sm max-w-[240px]">
          Or press <span className="text-blue-300">Follow cascade</span> to watch word of mouth
          change real browsing behavior.
        </div>
      </div>
    );
  }
  const player = game.world.players.get(playerId);
  if (!player) return null;
  const name = game.playerDescriptions.get(playerId)?.name ?? 'Resident';
  const snapshot = lt.residentForPlayer(name, allNames);
  const isFollowed = followedPlayerId === playerId;
  const stage = STAGE_META[snapshot.stage];

  return (
    <>
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="flex-grow min-w-0">
          <h2 className="font-display text-3xl tracking-wider text-white leading-none flex items-center gap-2">
            <span
              className="inline-block w-3.5 h-3.5 rounded-full border border-black/40"
              style={{ backgroundColor: stage.css }}
              title={stage.label}
            />
            <span className="truncate">
              {snapshot.resident}
              {snapshot.resident !== name && (
                <span className="text-clay-100/50 text-lg ml-2">({name})</span>
              )}
            </span>
          </h2>
          <div className="text-sm text-clay-100/70 mt-1">{snapshot.role}</div>
        </div>
        <button
          onClick={() => setFollowedPlayerId(isFollowed ? undefined : playerId)}
          className={clsx(
            'rounded px-2 py-1 text-xs font-body border shrink-0',
            isFollowed
              ? 'bg-blue-500 text-white border-blue-400'
              : 'text-blue-300 border-blue-500 hover:bg-blue-500 hover:text-white',
          )}
        >
          {isFollowed ? '◉ Following' : '◎ Follow'}
        </button>
        <button
          className="shrink-0 rounded bg-clay-700 hover:bg-clay-500 p-2 cursor-pointer"
          onClick={() => {
            setSelectedElement(undefined);
            if (isFollowed) setFollowedPlayerId(undefined);
          }}
        >
          <img className="w-4 h-4" src={closeImg} alt="Close" />
        </button>
      </div>

      {/* Activity strip */}
      <div className="mt-2 text-sm text-clay-100/70">
        {snapshot.activity === 'browsing' && (
          <span className="text-blue-300">💻 Browsing the website right now</span>
        )}
        {snapshot.activity === 'talking' && (
          <span className="text-yellow-300">💬 In a conversation</span>
        )}
        {snapshot.activity === 'idle' && <span>Wandering the town</span>}
      </div>

      {/* Tabs */}
      <div className="mt-4 mb-4 grid grid-cols-3 gap-1 rounded bg-clay-900/80 p-1">
        {(['mind', 'browser', 'social'] as InspectorTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={clsx(
              'rounded py-1.5 text-sm font-display tracking-wider uppercase',
              activeTab === t
                ? 'bg-yellow-400 text-black'
                : 'text-clay-100/70 hover:text-white',
              t === 'browser' && snapshot.activity === 'browsing' && activeTab !== t
                ? 'animate-pulse text-blue-300'
                : '',
            )}
          >
            {t === 'mind' ? '🧠 Mind' : t === 'browser' ? '💻 Browser' : '💬 Social'}
          </button>
        ))}
      </div>

      <div className="flex-grow">
        {activeTab === 'mind' && <MindTab snapshot={snapshot} />}
        {activeTab === 'browser' && <BrowserTab snapshot={snapshot} />}
        {activeTab === 'social' && (
          <SocialTab
            snapshot={snapshot}
            worldId={worldId}
            game={game}
            playerId={playerId}
            scrollViewRef={scrollViewRef}
          />
        )}
      </div>
    </>
  );
}
