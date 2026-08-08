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
  const followedActivity = followedSnapshot?.activity;
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
  return (
    <>
      {SHOW_DEBUG_UI && <DebugTimeManager timeManager={timeManager} width={200} height={100} />}
      <MetricsBar
        playerNames={allNames}
        followedName={followedSnapshot?.resident}
        onFollowCascade={followCascade}
      />
      <div className="mx-auto w-full max-w grid grid-rows-[240px_1fr] lg:grid-rows-[1fr] lg:grid-cols-[1fr_auto] lg:grow max-w-[1400px] min-h-[480px] game-frame">
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
        {/* Inspector column */}
        <div
          className="flex flex-col overflow-y-auto shrink-0 px-4 py-6 sm:px-6 lg:w-96 xl:pr-6 border-t-8 sm:border-t-0 sm:border-l-8 border-brown-900 lt-inspector text-brown-100"
          ref={scrollViewRef}
        >
          <ResidentInspector
            worldId={worldId}
            engineId={engineId}
            game={game}
            playerId={selectedElement?.id}
            setSelectedElement={setSelectedElement}
            scrollViewRef={scrollViewRef}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            followedPlayerId={followedPlayerId}
            setFollowedPlayerId={setFollowedPlayerId}
          />
        </div>
      </div>
    </>
  );
}
