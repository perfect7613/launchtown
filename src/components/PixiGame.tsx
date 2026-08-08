import { useApp } from '@pixi/react';
import { Player, SelectElement } from './Player.tsx';
import { useCallback, useRef } from 'react';
import { PixiStaticMap } from './PixiStaticMap.tsx';
import PixiViewport from './PixiViewport.tsx';
import { Viewport } from 'pixi-viewport';
import { Id } from '../../convex/_generated/dataModel';
import { DebugPath } from './DebugPath.tsx';
import { SHOW_DEBUG_UI } from './Game.tsx';
import { ServerGame } from '../hooks/serverGame.ts';
import { GameId } from '../../convex/aiTown/ids.ts';
import { Graphics } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { FollowCamera } from './FollowCamera.tsx';
import { InfluenceLayer } from './InfluenceLayer.tsx';
import { useLaunchTown } from '../launchtown/useLaunchTown.tsx';

// Dusk overlay: multiplies the map towards a deep blue so LaunchTown reads
// as a night-market town while sprites and rings stay legible.
function NightOverlay({ width, height }: { width: number; height: number }) {
  const draw = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      g.beginFill(0x27306b, 0.55);
      g.drawRect(0, 0, width, height);
      g.endFill();
    },
    [width, height],
  );
  return <Graphics draw={draw} blendMode={PIXI.BLEND_MODES.MULTIPLY} eventMode="none" />;
}

export const PixiGame = (props: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  historicalTime: number | undefined;
  width: number;
  height: number;
  followedPlayerId?: GameId<'players'>;
  setSelectedElement: SelectElement;
}) => {
  // PIXI setup.
  const pixiApp = useApp();
  const viewportRef = useRef<Viewport | undefined>();
  const lt = useLaunchTown();

  const { width, height, tileDim } = props.game.worldMap;
  const players = [...props.game.world.players.values()];
  const allNames = [...props.game.playerDescriptions.values()].map((d) => d.name);
  const followedPlayer =
    props.followedPlayerId && props.game.world.players.get(props.followedPlayerId);

  return (
    <PixiViewport
      app={pixiApp}
      screenWidth={props.width}
      screenHeight={props.height}
      worldWidth={width * tileDim}
      worldHeight={height * tileDim}
      viewportRef={viewportRef}
    >
      <PixiStaticMap map={props.game.worldMap} />
      <NightOverlay width={width * tileDim} height={height * tileDim} />
      {players.map(
        (p) =>
          SHOW_DEBUG_UI && (
            <DebugPath key={`path-${p.id}`} player={p} tileDim={tileDim} />
          ),
      )}
      {players.map((p) => (
        <Player
          key={`player-${p.id}`}
          game={props.game}
          player={p}
          isViewer={false}
          onClick={props.setSelectedElement}
          historicalTime={props.historicalTime}
        />
      ))}
      <InfluenceLayer
        game={props.game}
        pulses={lt.pulses}
        resolvePlayerName={(resident) => lt.playerNameForResident(resident, allNames)}
      />
      {followedPlayer && (
        <FollowCamera
          game={props.game}
          player={followedPlayer}
          historicalTime={props.historicalTime}
          viewportRef={viewportRef}
        />
      )}
    </PixiViewport>
  );
};
export default PixiGame;
