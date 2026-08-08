// Influence animation layer (plan §8 / demo script step 2):
//  - a speech-bubble arrow between the two residents in an influence event
//  - stat delta popups ("trust −30%") rising above the listener
// Also draws a subtle arrow for any live AI Town conversation so the town
// reads as social at demo distance.

import { Container, Graphics, Text } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useCallback } from 'react';
import { ServerGame } from '../hooks/serverGame';
import { InfluencePulse } from '../launchtown/types';

const POSITIVE = 0x4ade80;
const NEGATIVE = 0xf87171;
const ARROW = 0xfacc15;

const statLabel: Record<string, string> = {
  awareness: 'awareness',
  curiosity: 'curiosity',
  trust: 'trust',
  intent: 'intent',
};

function Arrow({
  from,
  to,
  color,
  alpha,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: number;
  alpha: number;
}) {
  const draw = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      // Trim the arrow so it starts/ends beside the sprites, not on them.
      const trim = Math.min(14, len / 3);
      const ux = dx / len;
      const uy = dy / len;
      const sx = from.x + ux * trim;
      const sy = from.y + uy * trim - 18;
      const ex = to.x - ux * trim;
      const ey = to.y - uy * trim - 18;
      g.lineStyle(2.5, color, alpha);
      // Slight arc via midpoint offset perpendicular to the segment.
      const mx = (sx + ex) / 2 - uy * 14;
      const my = (sy + ey) / 2 + ux * 14;
      g.moveTo(sx, sy);
      g.quadraticCurveTo(mx, my, ex, ey);
      // Arrowhead.
      const angle = Math.atan2(ey - my, ex - mx);
      const headLen = 8;
      g.beginFill(color, alpha);
      g.drawPolygon([
        ex,
        ey,
        ex - headLen * Math.cos(angle - 0.45),
        ey - headLen * Math.sin(angle - 0.45),
        ex - headLen * Math.cos(angle + 0.45),
        ey - headLen * Math.sin(angle + 0.45),
      ]);
      g.endFill();
    },
    [from.x, from.y, to.x, to.y, color, alpha],
  );
  return <Graphics draw={draw} />;
}

export function InfluenceLayer({
  game,
  pulses,
  resolvePlayerName,
}: {
  game: ServerGame;
  pulses: InfluencePulse[];
  resolvePlayerName: (resident: string) => string | undefined;
}) {
  const tileDim = game.worldMap.tileDim;

  const positionOf = (playerName: string) => {
    for (const [playerId, desc] of game.playerDescriptions.entries()) {
      if (desc.name === playerName) {
        const player = game.world.players.get(playerId);
        if (player) {
          return {
            x: player.position.x * tileDim + tileDim / 2,
            y: player.position.y * tileDim + tileDim / 2,
          };
        }
      }
    }
    return undefined;
  };

  // Live AI Town conversations: speaker → listener arrows.
  const conversationArrows: { from: { x: number; y: number }; to: { x: number; y: number } }[] =
    [];
  for (const conversation of game.world.conversations.values()) {
    const typing = conversation.isTyping;
    if (!typing) continue;
    const participantIds = [...conversation.participants.keys()];
    if (participantIds.length < 2) continue;
    const listenerId = participantIds.find((id) => id !== typing.playerId);
    const speaker = game.world.players.get(typing.playerId);
    const listener = listenerId && game.world.players.get(listenerId);
    if (!speaker || !listener) continue;
    conversationArrows.push({
      from: {
        x: speaker.position.x * tileDim + tileDim / 2,
        y: speaker.position.y * tileDim + tileDim / 2,
      },
      to: {
        x: listener.position.x * tileDim + tileDim / 2,
        y: listener.position.y * tileDim + tileDim / 2,
      },
    });
  }

  return (
    <Container>
      {conversationArrows.map((a, i) => (
        <Arrow key={`conv-${i}`} from={a.from} to={a.to} color={ARROW} alpha={0.5} />
      ))}
      {pulses.map((pulse) => {
        const fromPlayer = resolvePlayerName(pulse.from);
        const toPlayer = resolvePlayerName(pulse.to);
        const from = fromPlayer ? positionOf(fromPlayer) : undefined;
        const to = toPlayer ? positionOf(toPlayer) : undefined;
        if (!from || !to) return null;
        // Fade the arrow out over the pulse lifetime.
        const alpha = Math.max(0, 1 - pulse.ageSec / 6);
        return (
          <Container key={pulse.id}>
            <Arrow from={from} to={to} color={ARROW} alpha={alpha} />
            <Text
              x={(from.x + to.x) / 2}
              y={(from.y + to.y) / 2 - 34}
              text={'💬'}
              scale={0.9}
              alpha={alpha}
              anchor={{ x: 0.5, y: 0.5 }}
            />
            {pulse.deltas.map((d, i) => {
              // Popups rise & fade, staggered per stat.
              const t = Math.max(0, pulse.ageSec - i * 0.7);
              const popupAlpha = Math.max(0, Math.min(1, t * 2) - t / 5);
              const rise = t * 9;
              const positive = d.delta >= 0;
              return (
                <Text
                  key={`${pulse.id}-${d.stat}`}
                  x={to.x}
                  y={to.y - 30 - i * 13 - rise}
                  alpha={popupAlpha}
                  anchor={{ x: 0.5, y: 0.5 }}
                  text={`${statLabel[d.stat] ?? d.stat} ${positive ? '+' : '−'}${Math.round(
                    Math.abs(d.delta) * 100,
                  )}%`}
                  style={
                    new PIXI.TextStyle({
                      fontFamily: 'monospace',
                      fontSize: 12,
                      fontWeight: '700',
                      fill: positive ? POSITIVE : NEGATIVE,
                      stroke: 0x000000,
                      strokeThickness: 3,
                    })
                  }
                />
              );
            })}
          </Container>
        );
      })}
    </Container>
  );
}
