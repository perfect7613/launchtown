import { useEffect, useRef, useState } from 'react';
import PixiGame from './PixiGame.tsx';

import { useElementSize } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import ResidentInspector from './ResidentInspector.tsx';
import MetricsBar from './MetricsBar.tsx';
import { api } from '../../convex/_generated/api';
import { useWorldHeartbeat } from '../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../hooks/useHistoricalTime.ts';
import { DebugTimeManager } from './DebugTimeManager.tsx';
import { GameId } from '../../convex/aiTown/ids.ts';
import { useServerGame } from '../hooks/serverGame.ts';
import { LaunchTownContext, useLaunchTown } from '../launchtown/useLaunchTown.tsx';
import { InspectorTab } from '../launchtown/types.ts';

export const SHOW_DEBUG_UI = !!import.meta.env.VITE_SHOW_DEBUG_UI;

export default function Game() {
  const convex = useConvex();
  const lt = useLaunchTown();
  const [selectedElement, setSelectedElement] = useState<{
    kind: 'player';
    id: GameId<'players'>;
  }>();
  const [followedPlayerId, setFollowedPlayerId] = useState<GameId<'players'>>();
  const [activeTab, setActiveTab] = useState<InspectorTab>('mind');
  const [gameWrapperRef, { width, height }] = useElementSize();

  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const engineId = worldStatus?.engineId;

  const game = useServerGame(worldId);

  // Send a periodic heartbeat to our world to keep it alive.
  useWorldHeartbeat();

  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);

  const scrollViewRef = useRef<HTMLDivElement>(null);

  // Follow Resident (P0): keep the followed resident selected and
  // auto-switch the inspector panel — Social while they talk, Browser while
  // they browse (plan §8).
  const allNames = game ? [...game.playerDescriptions.values()].map((d) => d.name) : [];
  const followedName =
    game && followedPlayerId ? game.playerDescriptions.get(followedPlayerId)?.name : undefined;
  const followedSnapshot = followedName
    ? lt.residentForPlayer(followedName, allNames)
    : undefined;
  // Live AI Town conversation membership also counts as "talking" (the
  // Convex adapter only reports browsing/idle).
  const followedPlayer = followedPlayerId && game?.world.players.get(followedPlayerId);
  const followedInConversation = !!(
    followedPlayer &&
    game &&
    game.world.playerConversation(followedPlayer)?.participants.get(followedPlayer.id)?.status
      .kind === 'participating'
  );
  const followedActivity =
    followedSnapshot &&
    (followedSnapshot.activity === 'browsing'
      ? 'browsing'
      : followedInConversation || followedSnapshot.activity === 'talking'
        ? 'talking'
        : 'idle');
  useEffect(() => {
    if (!followedPlayerId || !followedActivity) return;
    setSelectedElement({ kind: 'player', id: followedPlayerId });
    if (followedActivity === 'browsing') setActiveTab('browser');
    else if (followedActivity === 'talking') setActiveTab('social');
  }, [followedPlayerId, followedActivity]);

  // "Follow cascade" targets the resident at the center of the demo spine.
  const followCascade = () => {
    if (!game) return;
    if (followedPlayerId) {
      setFollowedPlayerId(undefined);
      return;
    }
    const rohanPlayerName = lt.playerNameForResident('Rohan', allNames);
    for (const [playerId, desc] of game.playerDescriptions.entries()) {
      if (desc.name === rohanPlayerName) {
        setFollowedPlayerId(playerId);
        setSelectedElement({ kind: 'player', id: playerId });
        return;
      }
    }
  };

  if (!worldId || !engineId || !game) {
    return null;
  }
  const inspectorOpen = !!selectedElement && game.world.players.has(selectedElement.id);
  return (
    <>
      {SHOW_DEBUG_UI && <DebugTimeManager timeManager={timeManager} width={200} height={100} />}
      <MetricsBar
        engineId={engineId}
        playerNames={allNames}
        followedName={followedSnapshot?.resident}
        onFollowCascade={followCascade}
      />
      <div
        className={`mx-auto grid min-h-[480px] w-full max-w-[1400px] lg:grow game-frame ${
          inspectorOpen
            ? 'grid-rows-[240px_1fr] lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[1fr]'
            : 'grid-cols-1'
        }`}
      >
        {/* Game area */}
        <div className="relative overflow-hidden bg-brown-900" ref={gameWrapperRef}>
          <div className="absolute inset-0">
            <div className="container">
              <Stage width={width} height={height} options={{ backgroundColor: 0x0d1025 }}>
                {/* Re-propagate contexts because they are not shared between renderers.
https://github.com/michalochman/react-pixi-fiber/issues/145#issuecomment-531549215 */}
                <ConvexProvider client={convex}>
                  <LaunchTownContext.Provider value={lt}>
                    <PixiGame
                      game={game}
                      worldId={worldId}
                      engineId={engineId}
                      width={width}
                      height={height}
                      historicalTime={historicalTime}
                      followedPlayerId={followedPlayerId}
                      setSelectedElement={setSelectedElement}
                    />
                  </LaunchTownContext.Provider>
                </ConvexProvider>
              </Stage>
            </div>
          </div>
        </div>
        {inspectorOpen && (
          <div
            className="flex shrink-0 flex-col overflow-y-auto border-t-8 border-brown-900 px-4 py-6 text-brown-100 sm:px-6 lg:w-96 lg:border-l-8 lg:border-t-0 xl:pr-6 lt-inspector"
            ref={scrollViewRef}
          >
            <ResidentInspector
              worldId={worldId}
              game={game}
              playerId={selectedElement.id}
              setSelectedElement={setSelectedElement}
              scrollViewRef={scrollViewRef}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              followedPlayerId={followedPlayerId}
              setFollowedPlayerId={setFollowedPlayerId}
            />
          </div>
        )}
      </div>
    </>
  );
}
