// Follow Resident (P0 demo spine): smoothly tracks the followed resident's
// interpolated position by recentering the pixi-viewport each frame.

import { useTick } from '@pixi/react';
import { Viewport } from 'pixi-viewport';
import { MutableRefObject, useRef } from 'react';
import { Player as ServerPlayer } from '../../convex/aiTown/player';
import { Location, locationFields, playerLocation } from '../../convex/aiTown/location';
import { useHistoricalValue } from '../hooks/useHistoricalValue';
import { ServerGame } from '../hooks/serverGame';

const FOLLOW_LERP = 0.12;
const FOLLOW_ZOOM = 1.6;

export function FollowCamera({
  game,
  player,
  historicalTime,
  viewportRef,
}: {
  game: ServerGame;
  player: ServerPlayer;
  historicalTime: number | undefined;
  viewportRef: MutableRefObject<Viewport | undefined>;
}) {
  const tileDim = game.worldMap.tileDim;
  const locationBuffer = game.world.historicalLocations?.get(player.id);
  const location = useHistoricalValue<Location>(
    locationFields,
    historicalTime,
    playerLocation(player),
    locationBuffer,
  );
  const target = useRef<{ x: number; y: number } | undefined>();
  if (location) {
    target.current = {
      x: location.x * tileDim + tileDim / 2,
      y: location.y * tileDim + tileDim / 2,
    };
  }

  useTick(() => {
    const viewport = viewportRef.current;
    const t = target.current;
    if (!viewport || !t) return;
    const cx = viewport.center.x + (t.x - viewport.center.x) * FOLLOW_LERP;
    const cy = viewport.center.y + (t.y - viewport.center.y) * FOLLOW_LERP;
    viewport.moveCenter(cx, cy);
    if (Math.abs(viewport.scale.x - FOLLOW_ZOOM) > 0.01) {
      viewport.setZoom(
        viewport.scale.x + (FOLLOW_ZOOM - viewport.scale.x) * FOLLOW_LERP * 0.5,
        true,
      );
    }
  });

  return null;
}
