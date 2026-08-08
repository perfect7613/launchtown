import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import closeImg from '../../assets/close.svg';
import { SelectElement } from './Player';
import { Messages } from './Messages';
import { GameId } from '../../convex/aiTown/ids';
import { ServerGame } from '../hooks/serverGame';

export default function PlayerDetails({
  worldId,
  game,
  playerId,
  setSelectedElement,
  scrollViewRef,
}: {
  worldId: Id<'worlds'>;
  game: ServerGame;
  playerId?: GameId<'players'>;
  setSelectedElement: SelectElement;
  scrollViewRef: React.RefObject<HTMLDivElement>;
}) {
  const player = playerId && game.world.players.get(playerId);
  const playerConversation = player && game.world.playerConversation(player);
  const previousConversation = useQuery(
    api.world.previousConversation,
    playerId ? { worldId, playerId } : 'skip',
  );
  const playerDescription = playerId && game.playerDescriptions.get(playerId);

  if (!playerId) {
    return (
      <div className="h-full text-xl flex text-center items-center p-4">
        Click a resident to inspect their activity and conversations.
      </div>
    );
  }
  if (!player) return null;
  const playerStatus = playerConversation?.participants.get(playerId)?.status;

  return (
    <>
      <div className="flex gap-4">
        <div className="box w-3/4 sm:w-full mr-auto">
          <h2 className="bg-brown-700 p-2 font-display text-2xl sm:text-4xl tracking-wider shadow-solid text-center">
            {playerDescription?.name}
          </h2>
        </div>
        <button
          type="button"
          className="button text-white shadow-solid text-2xl cursor-pointer pointer-events-auto"
          onClick={() => setSelectedElement(undefined)}
        >
          <span className="block h-full bg-clay-700 p-2">
            <img className="w-4 h-4 sm:w-5 sm:h-5" src={closeImg} alt="Close" />
          </span>
        </button>
      </div>
      {!playerConversation && player.activity && player.activity.until > Date.now() && (
        <div className="box flex-grow mt-6">
          <h2 className="bg-brown-700 text-base sm:text-lg text-center">
            {player.activity.description}
          </h2>
        </div>
      )}
      <div className="desc my-6">
        <p className="leading-tight -m-4 bg-brown-700 text-base sm:text-sm">
          {playerDescription?.description}
        </p>
      </div>
      {playerConversation && playerStatus?.kind === 'participating' && (
        <Messages
          worldId={worldId}
          conversation={{ kind: 'active', doc: playerConversation }}
          scrollViewRef={scrollViewRef}
        />
      )}
      {!playerConversation && previousConversation && (
        <>
          <div className="box flex-grow">
            <h2 className="bg-brown-700 text-lg text-center">Previous conversation</h2>
          </div>
          <Messages
            worldId={worldId}
            conversation={{ kind: 'archived', doc: previousConversation }}
            scrollViewRef={scrollViewRef}
          />
        </>
      )}
    </>
  );
}
